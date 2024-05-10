const mysql = require("mysql2");

let db_con = mysql.createConnection({
  host: "serengeti-game-dev.cxcycr5et3zy.us-east-2.rds.amazonaws.com",
  user: "admin",
  password: "password",
  database: "serengetiboard",
});


db_con.connect(function (err) {
  if (err) {
    console.error("Error connecting to MySQL database:", err);
    return;
  }
  console.log("Connected to MySQL database");
});

module.exports = db_con;
