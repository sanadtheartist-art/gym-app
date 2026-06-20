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
    setStatus('Generating PDF…');
    try {
      const { data: workouts, error } = await supabase
        .from('workouts')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // ── Colour palette ──────────────────────────────────────────
      const C = {
        bg:      [13,  13,  13 ],
        card:    [26,  26,  26 ],
        lime:    [200, 255,  0 ],
        orange:  [255, 107, 44 ],
        white:   [240, 240, 240],
        muted:   [100, 100, 100],
        row1:    [20,  20,  20 ],
        row2:    [30,  30,  30 ],
      };

      // ── Cover Header ─────────────────────────────────────────────
      doc.setFillColor(...C.bg);
      doc.rect(0, 0, pageW, pageH, 'F');

      // Top accent gradient bar
      doc.setFillColor(...C.lime);
      doc.rect(0, 0, pageW * 0.65, 4, 'F');
      doc.setFillColor(...C.orange);
      doc.rect(pageW * 0.65, 0, pageW * 0.35, 4, 'F');

      // Brand name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(36);
      doc.setTextColor(...C.lime);
      doc.text('JEXI', 14, 22);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...C.muted);
      doc.text('WORKOUT REPORT', 14, 28);

      // Right side date
      const today = new Date();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C.muted);
      doc.text(`Generated: ${today.toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'})}`, pageW - 14, 22, { align: 'right' });

      // Divider
      doc.setDrawColor(...C.lime);
      doc.setLineWidth(0.4);
      doc.line(14, 33, pageW - 14, 33);

      // ── Summary Cards ────────────────────────────────────────────
      const totalSets = workouts.reduce((a, w) => a + (w.sets_data?.length || w.sets || 0), 0);
      const totalVol  = workouts.reduce((a, w) => {
        return a + (w.sets_data || []).reduce((s, sd) => s + (parseFloat(sd.weight) || 0) * (parseInt(sd.reps) || 0), 0);
      }, 0);
      const muscles   = [...new Set(workouts.map(w => w.muscle_group).filter(Boolean))];
      const sessions  = [...new Set(workouts.map(w => w.timestamp?.split('T')[0]))].length;

      const cards = [
        { label: 'WORKOUTS',    value: workouts.length },
        { label: 'SESSIONS',    value: sessions },
        { label: 'TOTAL SETS',  value: totalSets },
        { label: 'VOL (kg)',    value: Math.round(totalVol).toLocaleString() },
      ];

      const cardW = (pageW - 28 - 9) / 4;
      cards.forEach((c, i) => {
        const x = 14 + i * (cardW + 3);
        doc.setFillColor(...C.card);
        doc.roundedRect(x, 38, cardW, 22, 2, 2, 'F');
        doc.setFillColor(...C.lime);
        doc.rect(x, 38, 2, 22, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(...C.white);
        doc.text(String(c.value), x + cardW / 2, 51, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(...C.muted);
        doc.text(c.label, x + cardW / 2, 57, { align: 'center' });
      });

      let curY = 68;

      // ── Per-muscle-group sections ─────────────────────────────────
      const grouped = {};
      workouts.forEach(w => {
        const key = w.muscle_group || 'Other';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(w);
      });

      const accentCycle = [C.lime, C.orange, [0, 240, 255], [160, 132, 250]];
      let accentIdx = 0;

      for (const [muscle, entries] of Object.entries(grouped)) {
        const accent = accentCycle[accentIdx % accentCycle.length];
        accentIdx++;

        // Section heading stripe
        if (curY + 50 > pageH - 20) { doc.addPage(); curY = 14; }

        doc.setFillColor(...C.card);
        doc.rect(14, curY, pageW - 28, 9, 'F');
        doc.setFillColor(...accent);
        doc.rect(14, curY, 3, 9, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...accent);
        doc.text(muscle.toUpperCase(), 20, curY + 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...C.muted);
        doc.text(`${entries.length} entries`, pageW - 14, curY + 6, { align: 'right' });

        curY += 12;

        const body = entries.map(w => {
          const d = new Date(w.timestamp);
          const dateStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
          const bestSet = (w.sets_data || []).reduce((b, s) => parseFloat(s.weight||0) > parseFloat(b.weight||0) ? s : b, { weight: 0, reps: 0 });
          const best = bestSet.weight > 0 ? `${bestSet.weight}${w.input_unit || 'kg'} x ${bestSet.reps}` : `${w.sets || '-'} x ${w.reps || '-'}`;
          return [dateStr, w.exercise_name || '-', w.sets_data?.length || w.sets || '-', best, w.custom_notes || ''];
        });

        autoTable(doc, {
          startY: curY,
          head: [['Date', 'Exercise', 'Sets', 'Best Set', 'Notes']],
          body,
          theme: 'plain',
          margin: { left: 14, right: 14 },
          styles: {
            fontSize: 8,
            cellPadding: { top: 3, bottom: 3, left: 3, right: 2 },
            textColor: C.white,
            fillColor: C.row1,
            font: 'helvetica',
          },
          alternateRowStyles: { fillColor: C.row2 },
          headStyles: {
            fillColor: [40, 40, 40],
            textColor: accent,
            fontStyle: 'bold',
            fontSize: 7.5,
          },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 12, halign: 'center' },
            3: { cellWidth: 32 },
            4: { cellWidth: 35, textColor: C.muted },
          },
          didDrawPage: (data) => {
            // Footer on every page
            doc.setFillColor(...C.lime);
            doc.rect(0, pageH - 3, pageW * 0.5, 3, 'F');
            doc.setFillColor(...C.orange);
            doc.rect(pageW * 0.5, pageH - 3, pageW * 0.5, 3, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...C.muted);
            doc.text('JEXI Gym Tracker', 14, pageH - 6);
            doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, pageW - 14, pageH - 6, { align: 'right' });
          },
        });

        curY = doc.lastAutoTable.finalY + 10;
      }

      doc.save(`jexi_report_${today.toISOString().split('T')[0]}.pdf`);
      setStatus('PDF generated successfully');
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
