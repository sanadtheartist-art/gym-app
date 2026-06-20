import { useRef, useState } from 'react';
import { Download, UploadCloud, Database, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function DataPortability({ onImported }) {
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const exportExcel = async () => {
    setBusy(true);
    setStatus('Generating Excel...');
    try {
      const [workoutsResult, splitsResult, splitExercisesResult] = await Promise.all([
        supabase.from('workouts').select('*').order('timestamp', { ascending: true }),
        supabase.from('splits').select('*').order('created_at', { ascending: true }),
        supabase.from('split_exercises').select('*').order('display_order', { ascending: true }),
      ]);

      if (workoutsResult.error) throw workoutsResult.error;
      if (splitsResult.error) throw splitsResult.error;
      if (splitExercisesResult.error) throw splitExercisesResult.error;

      const wb = XLSX.utils.book_new();

      const wsWorkouts = XLSX.utils.json_to_sheet((workoutsResult.data || []).map(w => ({
        ...w,
        assisted_muscles: JSON.stringify(w.assisted_muscles || {}),
        sets_data: JSON.stringify(w.sets_data || [])
      })));
      XLSX.utils.book_append_sheet(wb, wsWorkouts, "Workouts");

      const wsSplits = XLSX.utils.json_to_sheet(splitsResult.data || []);
      XLSX.utils.book_append_sheet(wb, wsSplits, "Splits");

      const wsSplitExercises = XLSX.utils.json_to_sheet(splitExercisesResult.data || []);
      XLSX.utils.book_append_sheet(wb, wsSplitExercises, "Split_Exercises");

      XLSX.writeFile(wb, `jexi_backup_${new Date().toISOString().split('T')[0]}.xlsx`);
      setStatus('Excel backup exported successfully');
    } catch (error) {
      setStatus(error.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const importExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setStatus('Reading Excel file...');

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);

      const workoutsRaw = XLSX.utils.sheet_to_json(wb.Sheets['Workouts'] || wb.Sheets[wb.SheetNames[0]] || []);
      const splitsRaw = XLSX.utils.sheet_to_json(wb.Sheets['Splits'] || []);
      const splitExercisesRaw = XLSX.utils.sheet_to_json(wb.Sheets['Split_Exercises'] || []);

      const workouts = workoutsRaw.map(w => ({
        ...w,
        assisted_muscles: typeof w.assisted_muscles === 'string' ? JSON.parse(w.assisted_muscles) : {},
        sets_data: typeof w.sets_data === 'string' ? JSON.parse(w.sets_data) : [],
        timestamp: w.timestamp || new Date().toISOString(),
        weight_kg: parseFloat(w.weight_kg) || 0,
        input_weight: parseFloat(w.input_weight) || 0,
        sets: parseInt(w.sets, 10) || 0,
        reps: parseInt(w.reps, 10) || 0,
        session_duration_seconds: parseInt(w.session_duration_seconds, 10) || 0,
        set_duration_seconds: parseInt(w.set_duration_seconds, 10) || 0
      }));

      setStatus('Wiping old data...');
      await supabase.from('split_exercises').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('workouts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('splits').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      setStatus('Restoring backup...');
      if (splitsRaw.length) {
        const { error } = await supabase.from('splits').upsert(splitsRaw);
        if (error) throw error;
      }
      if (splitExercisesRaw.length) {
        const { error } = await supabase.from('split_exercises').upsert(splitExercisesRaw);
        if (error) throw error;
      }
      if (workouts.length) {
        const { error } = await supabase.from('workouts').upsert(workouts);
        if (error) throw error;
      }

      setStatus('Backup restored successfully!');
      onImported?.();
    } catch (error) {
      setStatus(error.message || 'Import failed');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  const exportPdf = async () => {
    setBusy(true);
    setStatus('Building your report…');
    try {
      const { data: workouts, error } = await supabase
        .from('workouts')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // ── Read the active theme accent colour from CSS vars ──────────
      const rootStyle   = getComputedStyle(document.documentElement);
      const accentHex   = rootStyle.getPropertyValue('--accent-primary').trim()   || '#C8FF00';
      const secondHex   = rootStyle.getPropertyValue('--accent-secondary').trim() || '#FF6B2C';

      const hexToRgb = (hex) => {
        const h = hex.replace('#', '');
        const bigint = parseInt(h.length === 3
          ? h.split('').map(c => c + c).join('')
          : h, 16);
        return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
      };

      // ── Palette ─────────────────────────────────────────────────────
      const C = {
        bg:      [10,  10,  10 ],
        card:    [22,  22,  22 ],
        card2:   [32,  32,  32 ],
        surface: [42,  42,  42 ],
        accent:  hexToRgb(accentHex),
        second:  hexToRgb(secondHex),
        white:   [235, 235, 235],
        muted:   [110, 110, 110],
        faint:   [55,  55,  55 ],
      };

      const doc     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW   = doc.internal.pageSize.getWidth();
      const pageH   = doc.internal.pageSize.getHeight();
      const today   = new Date();
      const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

      // ─────────────────────────────────────────────────────────────────
      // COVER PAGE
      // ─────────────────────────────────────────────────────────────────
      // Full black background
      doc.setFillColor(...C.bg);
      doc.rect(0, 0, pageW, pageH, 'F');

      // Large accent glow blob (top-right)
      doc.setFillColor(...C.accent.map(v => Math.min(v + 20, 255)));
      doc.setGState(doc.GState({ opacity: 0.07 }));
      doc.circle(pageW - 20, 30, 60, 'F');
      doc.setGState(doc.GState({ opacity: 1 }));

      // Top accent stripe (full width, 5mm)
      doc.setFillColor(...C.accent);
      doc.rect(0, 0, pageW * 0.6, 5, 'F');
      doc.setFillColor(...C.second);
      doc.rect(pageW * 0.6, 0, pageW * 0.4, 5, 'F');

      // Brand logo area
      doc.setFillColor(...C.card);
      doc.roundedRect(14, 22, 48, 48, 6, 6, 'F');
      doc.setFillColor(...C.accent);
      doc.roundedRect(16, 24, 44, 44, 5, 5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(10, 10, 10);
      doc.text('JEXI', 38, 51, { align: 'center' });

      // Title block
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(32);
      doc.setTextColor(...C.white);
      doc.text('Workout Report', 70, 40);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...C.muted);
      doc.text('Personal Training Log', 70, 49);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...C.accent);
      doc.text(`Generated ${dateStr}`, 70, 58);

      // Thin rule under title
      doc.setDrawColor(...C.faint);
      doc.setLineWidth(0.3);
      doc.line(14, 78, pageW - 14, 78);

      // ── Summary Stat Cards ───────────────────────────────────────────
      const totalSets = workouts.reduce((a, w) => a + (w.sets_data?.length || w.sets || 0), 0);
      const totalVol  = workouts.reduce((a, w) =>
        a + (w.sets_data || []).reduce((s, sd) => s + (parseFloat(sd.weight) || 0) * (parseInt(sd.reps) || 0), 0), 0);
      const sessions  = [...new Set(workouts.map(w => w.timestamp?.split('T')[0]))].length;
      const exercises = [...new Set(workouts.map(w => w.exercise_name).filter(Boolean))].length;

      const stats = [
        { label: 'Entries',   value: workouts.length.toLocaleString() },
        { label: 'Sessions',  value: sessions.toLocaleString() },
        { label: 'Exercises', value: exercises.toLocaleString() },
        { label: 'Total Sets',value: totalSets.toLocaleString() },
        { label: 'Volume',    value: `${Math.round(totalVol / 1000)}t` },
      ];

      const statCardW = (pageW - 28 - (stats.length - 1) * 3) / stats.length;
      stats.forEach((s, i) => {
        const x = 14 + i * (statCardW + 3);
        const y = 84;

        doc.setFillColor(...C.card);
        doc.roundedRect(x, y, statCardW, 28, 3, 3, 'F');

        // Left accent stripe
        const stripeColor = i % 2 === 0 ? C.accent : C.second;
        doc.setFillColor(...stripeColor);
        doc.roundedRect(x, y, 2.5, 28, 1, 1, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(...C.white);
        doc.text(String(s.value), x + statCardW / 2, y + 13, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...C.muted);
        doc.text(s.label.toUpperCase(), x + statCardW / 2, y + 22, { align: 'center' });
      });

      // ── Top 5 Exercises by volume ─────────────────────────────────
      const volByEx = {};
      workouts.forEach(w => {
        const name = w.exercise_name || 'Other';
        const vol = (w.sets_data || []).reduce((s, sd) => s + (parseFloat(sd.weight) || 0) * (parseInt(sd.reps) || 0), 0);
        volByEx[name] = (volByEx[name] || 0) + vol;
      });
      const topEx = Object.entries(volByEx)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
      const maxVol = topEx[0]?.[1] || 1;

      let cy = 122;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C.accent);
      doc.text('TOP EXERCISES BY VOLUME', 14, cy);

      doc.setDrawColor(...C.faint);
      doc.setLineWidth(0.2);
      doc.line(14, cy + 2, pageW - 14, cy + 2);
      cy += 7;

      topEx.forEach(([name, vol], i) => {
        const barMaxW  = pageW - 80;
        const barW     = (vol / maxVol) * barMaxW;
        const isAccent = i % 2 === 0;

        // Bar track
        doc.setFillColor(...C.faint);
        doc.roundedRect(54, cy, barMaxW, 5, 1, 1, 'F');

        // Bar fill
        doc.setFillColor(...(isAccent ? C.accent : C.second));
        if (barW > 0) doc.roundedRect(54, cy, barW, 5, 1, 1, 'F');

        // Name
        doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...C.white);
        doc.text(name.length > 22 ? name.slice(0, 21) + '…' : name, 14, cy + 4);

        // Vol label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...C.muted);
        doc.text(`${Math.round(vol).toLocaleString()} kg`, pageW - 14, cy + 4, { align: 'right' });

        cy += 9;
      });

      // Bottom rule on cover
      cy += 4;
      doc.setDrawColor(...C.faint);
      doc.setLineWidth(0.2);
      doc.line(14, cy, pageW - 14, cy);

      // Cover footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text('JEXI Gym Tracker  ·  Personal & Confidential', pageW / 2, pageH - 12, { align: 'center' });
      doc.setFillColor(...C.accent);
      doc.rect(0, pageH - 4, pageW * 0.5, 4, 'F');
      doc.setFillColor(...C.second);
      doc.rect(pageW * 0.5, pageH - 4, pageW * 0.5, 4, 'F');

      // ─────────────────────────────────────────────────────────────────
      // DATA PAGES — grouped by muscle group
      // ─────────────────────────────────────────────────────────────────
      const grouped = {};
      workouts.forEach(w => {
        const key = w.muscle_group || 'Other';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(w);
      });

      const drawPageHeader = (pageNum) => {
        doc.setFillColor(...C.bg);
        doc.rect(0, 0, pageW, 14, 'F');
        doc.setFillColor(...C.accent);
        doc.rect(0, 0, pageW * 0.45, 2, 'F');
        doc.setFillColor(...C.second);
        doc.rect(pageW * 0.45, 0, pageW * 0.55, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...C.accent);
        doc.text('JEXI', 14, 9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.muted);
        doc.text('Workout Report', 22, 9);
        doc.text(`Page ${pageNum}  ·  ${dateStr}`, pageW - 14, 9, { align: 'right' });
      };

      const accentCycle = [C.accent, C.second, [60, 210, 255], [180, 140, 255]];
      let accentIdx = 0;
      let pageNum = 2;

      for (const [muscle, entries] of Object.entries(grouped)) {
        doc.addPage();

        // Full bg
        doc.setFillColor(...C.bg);
        doc.rect(0, 0, pageW, pageH, 'F');
        drawPageHeader(pageNum++);

        const accent = accentCycle[accentIdx % accentCycle.length];
        accentIdx++;

        // Section title bar
        doc.setFillColor(...C.card);
        doc.rect(14, 18, pageW - 28, 12, 'F');
        doc.setFillColor(...accent);
        doc.rect(14, 18, 4, 12, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...accent);
        doc.text(muscle.toUpperCase(), 22, 26);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...C.muted);
        doc.text(`${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`, pageW - 14, 26, { align: 'right' });

        // Quick stats for this group
        const grpSets = entries.reduce((a, w) => a + (w.sets_data?.length || w.sets || 0), 0);
        const grpVol  = entries.reduce((a, w) =>
          a + (w.sets_data || []).reduce((s, sd) => s + (parseFloat(sd.weight) || 0) * (parseInt(sd.reps) || 0), 0), 0);
        const grpMax  = entries.reduce((a, w) => {
          const m = (w.sets_data || []).reduce((mx, sd) => Math.max(mx, parseFloat(sd.weight) || 0), w.weight_kg || 0);
          return Math.max(a, m);
        }, 0);

        const miniStats = [
          { l: 'Sets',  v: grpSets.toLocaleString() },
          { l: 'Volume',v: `${Math.round(grpVol).toLocaleString()} kg` },
          { l: 'Max Wt',v: `${grpMax} kg` },
        ];
        const msW = (pageW - 28 - 4) / 3;
        miniStats.forEach((ms, i) => {
          const x = 14 + i * (msW + 2);
          doc.setFillColor(...C.card2);
          doc.roundedRect(x, 33, msW, 14, 2, 2, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(...C.white);
          doc.text(ms.v, x + msW / 2, 41, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(...C.muted);
          doc.text(ms.l.toUpperCase(), x + msW / 2, 44, { align: 'center' });
        });

        const body = entries.map(w => {
          const d     = new Date(w.timestamp);
          const ds    = `${d.getDate().toString().padStart(2,'0')} ${d.toLocaleString('default',{month:'short'})} ${d.getFullYear()}`;
          const time  = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          const best  = (w.sets_data || []).reduce((b, s) =>
            parseFloat(s.weight || 0) > parseFloat(b.weight || 0) ? s : b, { weight: 0, reps: 0 });
          const bestStr = best.weight > 0
            ? `${best.weight}${w.input_unit || 'kg'} × ${best.reps}`
            : `${w.weight_kg || '-'} kg`;
          const est1rm  = best.weight > 0
            ? Math.round(parseFloat(best.weight) * (1 + parseFloat(best.reps || 0) / 30))
            : '';
          return [
            `${ds}\n${time}`,
            w.exercise_name || '-',
            String(w.sets_data?.length || w.sets || '-'),
            bestStr,
            est1rm ? `${est1rm} kg` : '-',
            w.custom_notes || '',
          ];
        });

        autoTable(doc, {
          startY: 51,
          head: [['Date', 'Exercise', 'Sets', 'Best Set', 'Est. 1RM', 'Notes']],
          body,
          theme: 'plain',
          margin: { left: 14, right: 14 },
          styles: {
            fontSize: 7.5,
            cellPadding: { top: 3.5, bottom: 3.5, left: 3.5, right: 3 },
            textColor: C.white,
            fillColor: C.card,
            font: 'helvetica',
            lineColor: C.faint,
            lineWidth: 0.15,
          },
          alternateRowStyles: { fillColor: C.card2 },
          headStyles: {
            fillColor: C.surface,
            textColor: accent,
            fontStyle: 'bold',
            fontSize: 7,
            halign: 'left',
            cellPadding: { top: 4, bottom: 4, left: 3.5, right: 3 },
          },
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 'auto', fontStyle: 'bold' },
            2: { cellWidth: 12, halign: 'center' },
            3: { cellWidth: 28 },
            4: { cellWidth: 20, halign: 'center', textColor: accent },
            5: { cellWidth: 30, textColor: C.muted, fontSize: 6.5 },
          },
          didDrawPage: () => {
            // Background on new pages
            doc.setFillColor(...C.bg);
            doc.rect(0, 0, pageW, 14, 'F');
            drawPageHeader(pageNum++);

            // Footer bar
            doc.setFillColor(...C.accent);
            doc.rect(0, pageH - 4, pageW * 0.5, 4, 'F');
            doc.setFillColor(...C.second);
            doc.rect(pageW * 0.5, pageH - 4, pageW * 0.5, 4, 'F');
          },
        });

        // Footer bar on section page
        doc.setFillColor(...C.accent);
        doc.rect(0, pageH - 4, pageW * 0.5, 4, 'F');
        doc.setFillColor(...C.second);
        doc.rect(pageW * 0.5, pageH - 4, pageW * 0.5, 4, 'F');
      }

      doc.save(`jexi_report_${today.toISOString().split('T')[0]}.pdf`);
      setStatus('PDF generated successfully ✓');
    } catch (err) {
      setStatus(err.message || 'PDF generation failed');
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="w-full pt-2">
      <div className="flex items-center gap-2 mb-3">
        <Database size={14} className="text-accent-primary" />
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">Data Vault</span>
      </div>

      <div className="grid gap-3 stagger-children">
        
        {/* PDF Export */}
        <button
          type="button"
          onClick={exportPdf}
          disabled={busy}
          className="group flex min-h-[120px] items-center gap-5 rounded-card glass-card p-6 text-left transition active:scale-[0.98] disabled:opacity-60 hover:border-accent-lime/30"
        >
          <span className="grid h-16 w-16 place-items-center rounded-[18px] bg-card-elevated text-text-main group-hover:bg-accent-lime/10 group-hover:text-accent-lime transition-colors">
            <FileText size={26} />
          </span>
          <div>
            <span className="block text-xl font-extrabold text-text-main group-hover:text-white transition-colors">Generate PDF</span>
            <span className="mt-1 block text-sm font-medium text-text-muted">Download a stylized, printable workout report</span>
          </div>
        </button>

        {/* Excel Export */}
        <button
          type="button"
          onClick={exportExcel}
          disabled={busy}
          className="group flex min-h-[120px] items-center gap-5 rounded-card glass-card p-6 text-left transition active:scale-[0.98] disabled:opacity-60 hover:border-accent-orange/30"
        >
          <span className="grid h-16 w-16 place-items-center rounded-[18px] bg-card-elevated text-text-main group-hover:bg-accent-orange/10 group-hover:text-accent-orange transition-colors">
            <Download size={26} />
          </span>
          <div>
            <span className="block text-xl font-extrabold text-text-main group-hover:text-white transition-colors">Export Excel</span>
            <span className="mt-1 block text-sm font-medium text-text-muted">Full database backup (.xlsx)</span>
          </div>
        </button>

        {/* Excel Import */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="group flex min-h-[120px] items-center gap-5 rounded-card glass-card p-6 text-left transition active:scale-[0.98] disabled:opacity-60 hover:border-quiet-red/30"
        >
          <span className="grid h-16 w-16 place-items-center rounded-[18px] bg-card-elevated text-text-main group-hover:bg-quiet-red/10 group-hover:text-quiet-red transition-colors">
            <UploadCloud size={26} />
          </span>
          <div>
            <span className="block text-xl font-extrabold text-text-main group-hover:text-white transition-colors">Restore Excel</span>
            <span className="mt-1 block text-sm font-medium text-text-muted">Restore your data from a previous Excel backup</span>
          </div>
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importExcel} />
      </div>

      {status ? (
        <div className="mt-8 rounded-xl bg-card-elevated p-4 border border-glass-border">
          <p className={`text-center text-sm font-bold ${status.toLowerCase().includes('fail') ? 'text-quiet-red' : 'text-accent-lime'}`}>
            {status}
          </p>
        </div>
      ) : null}
    </div>
  );
}
