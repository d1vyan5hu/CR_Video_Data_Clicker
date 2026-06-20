const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database(
  "./annotations.db",
  (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log(
        "SQLite Connected"
      );

      db.run(`
        CREATE TABLE IF NOT EXISTS annotations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,

          timestamp REAL,

          x REAL,

          y REAL,

          data TEXT,

          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
  }
);

module.exports = db;