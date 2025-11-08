function parseEuDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // 1) Format: 07-Nov-25 (dd-MMM-yy)
  // e.g. from your Excel export
  let m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (m) {
    const [_, dd, monStr, yy] = m;
    const months = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    const month = months[monStr.toLowerCase()];
    if (month === undefined) throw new Error('Bad month in date: ' + s);

    // EuroMillions starts 2004; all your data is 20xx
    const year2 = parseInt(yy, 10);
    const year = year2 >= 4 ? 2000 + year2 : 2100 + year2; // paranoid, but safe

    const day = parseInt(dd, 10);
    return new Date(Date.UTC(year, month, day));
  }

  // 2) Format: 07/11/2025 or 07.11.2025 (dd/mm/yyyy or dd.mm.yyyy)
  m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (m) {
    const [_, dd, mm, yyyy] = m;
    const day = parseInt(dd, 10);
    const month = parseInt(mm, 10) - 1;
    const year = parseInt(yyyy, 10);
    return new Date(Date.UTC(year, month, day));
  }

  // 3) ISO: 2025-11-07 → still support if you ever use it
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) {
    return new Date(iso);
  }

  throw new Error('Unrecognized date format: ' + s);
}

function parseCSV(text) {
  const [header, ...rows] = text.trim().split(/\r?\n/);
  const keys = header.split(',');
  return rows
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const vals = line.split(',');
      const obj = {};
      keys.forEach((k, i) => {
        obj[k] = vals[i];
      });

      // use EU-aware parser for dates
      obj.date = parseEuDate(obj.date);

      // convert numbers
      ['n1', 'n2', 'n3', 'n4', 'n5', 's1', 's2'].forEach((k) => {
        obj[k] = Number(obj[k]);
      });

      return obj;
    });
}
