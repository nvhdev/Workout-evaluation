const fs = require('fs');
const path = require('path');

// Calculate ISO week number from date
function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
  return weekNo;
}

// Format date as local YYYY-MM-DD
function fmtLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Parse CSV file with headers
function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ? values[idx].trim() : '';
    });
    rows.push(row);
  }
  
  return rows;
}

// Get all planning files (weeks) from planning directory
function getAllPlanningFiles() {
  const planningDir = path.join(__dirname, '..', 'data', 'planning');
  
  if (!fs.existsSync(planningDir)) {
    return [];
  }
  
  const files = fs.readdirSync(planningDir)
    .filter(f => f.endsWith('.csv'))
    .map(f => ({
      filename: f,
      path: path.join(planningDir, f)
    }));
  
  return files.sort((a, b) => a.filename.localeCompare(b.filename));
}

// Get all weeks from all planning CSV files
function getAllWeeks() {
  const files = getAllPlanningFiles();
  const allWeeks = [];
  
  files.forEach(file => {
    const rows = parseCSV(file.path);
    rows.forEach(row => {
      if (row.Week_nr && !allWeeks.find(w => w.week_nr === parseInt(row.Week_nr))) {
        // Get all workouts for this week to find date range
        const weekNumber = parseInt(row.Week_nr);
        const weekWorkouts = rows.filter(r => parseInt(r.Week_nr) === weekNumber);
        
        // Extract dates and find min/max
        const dates = weekWorkouts
          .map(w => new Date(w.Datum))
          .filter(d => !isNaN(d.getTime()))
          .sort((a, b) => a - b);
        
        let startDate = dates[0];
        let endDate = dates[dates.length - 1];
        
        if (!startDate || !endDate) {
          startDate = new Date();
          endDate = new Date();
        }
        
        const isoWeekNum = isoWeek(startDate);
        const year = startDate.getFullYear();
        
        allWeeks.push({
          week_nr: weekNumber,
          blok_week: `W${weekNumber}`,
          iso_week: isoWeekNum,
          year: year,
          start_date: fmtLocal(startDate),
          end_date: fmtLocal(endDate),
          week_label: `Week ${isoWeekNum} (${year})`,
          filename: file.filename,
          filePath: file.path
        });
      }
    });
  });
  
  return allWeeks.sort((a, b) => a.week_nr - b.week_nr);
}

// Get workouts for a specific week
function getWorkoutsByWeek(weekNumber) {
  const files = getAllPlanningFiles();
  
  for (const file of files) {
    const rows = parseCSV(file.path);
    const weekWorkouts = rows.filter(row => parseInt(row.Week_nr) === weekNumber);
    
    if (weekWorkouts.length > 0) {
      return weekWorkouts.map(formatWorkout);
    }
  }
  
  return [];
}

// Format workout row for display
function formatWorkout(row) {
  const datumDate = new Date(row.Datum);
  const fmtLocal = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  
  return {
    blok: row.Blok || '-',
    week_nr: row.Week_nr || '-',
    datum: fmtLocal(datumDate) || row.Datum || '-',
    dag: row.Dag || '-',
    type: row.Type || '-',
    titel: row.Titel || '-',
    beschrijving: row.Beschrijving || '-',
    duurloop_duur_min: row.Duurloop_duur_min || '-',
    duurloop_zone: row.Duurloop_zone || '-',
    hs_min_bpm: row.HS_min_bpm || '-',
    hs_max_bpm: row.HS_max_bpm || '-',
    pace_min_km: row.Pace_min_km || '-',
    pace_max_km: row.Pace_max_km || '-',
    interval_type: row.Interval_type || '-',
    interval_herhalingen: row.Interval_herhalingen || '-',
    interval_afstand_m: row.Interval_afstand_m || '-',
    interval_doel_pace: row.Interval_doel_pace || '-',
    interval_herstel: row.Interval_herstel || '-',
    geschat_totaal_km: row.Geschat_totaal_km || '-',
    herstelweek: row.Herstelweek === 'Ja' ? true : false,
    notitie: row.Notitie || '-'
  };
}

module.exports = {
  parseCSV,
  getAllPlanningFiles,
  getAllWeeks,
  getWorkoutsByWeek,
  formatWorkout
};
