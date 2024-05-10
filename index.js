const express = require("express");
const app = express();
var bodyParser = require("body-parser");
app.use(bodyParser.json());
const http = require("http").Server(app);
const cors = require("cors");
const mysql = require("./db");
const { METHODS } = require("http");
app.use(cors());
const PORT = 5000;
// Add this to where your other requires are
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    method: ["GET", "POST"],
  },
});
// Above our `app.get("/users")` handler

io.on("connection", (socket) => {
  console.log(`⚡: ${socket.id} user just connected!`);
});

function disconnectUser(res) {
  mysql.query(
    `update serengetiboard.room_agent_animal set active = 0 where  updated_date  < CURRENT_TIMESTAMP - INTERVAL 15 SECOND`,
    (error, result) => {
      if (error) {
        console.error("Error updating FLAG 0 :", error);
      }
      io.emit("userDisconnect", "userDisconnect");
    }
  );
}

setInterval(disconnectUser, 15000);

app.post("/CreateRoomAgent", async (request, response) => {
  const { agent_name, room_name, updated_date, active, socket_id } =
    request.body;
  mysql.query(
    "INSERT INTO room_agent_animal (agent_name,room_name,active,socket_id) VALUES (?,?,?,?)",
    [agent_name, room_name, active, socket_id],
    (error, result) => {
      if (error) {
        throw error;
      }
      io.emit("roomAgent", "Room agent created successfully");
      response.status(200).send("Room agent created successfully"); // Sending a response back to the client
    }
  );

  mysql.query(
    `INSERT INTO room (name,created_date) select UUID(), now()where not exists ( SELECT r.name as room_name, sum(if(ra.agent_name IS NULL,0,1)) as agent_count FROM room as r LEFT JOIN room_agent_animal as ra on r.name = ra.room_name and ra.active =1 GROUP BY r.name having count(*) <3 and  count(*) > 0)`
  );
});

app.post("/updatedAnimal", async (request, response) => {
  const { animal, room_name, agent_name } = request.body;
  mysql.query(
    `UPDATE room_agent_animal 
    SET animal = ?, updated_date = NOW() 
    WHERE room_name = ? AND agent_name = ?;`, // Setting created_date to NOW()
    [animal, room_name, agent_name],
    (error, result) => {
      if (error) {
        console.error("Error updating chosen animal:", error);
        response.status(500).send("Internal Server Error");
      }
      io.emit("updatedAnimal", "Chosen animal updated successfully");
      response.status(200).send("Chosen animal updated successfully");
    }
  );
});

app.get("/CheckName", (req, res) => {
  const { agent_name, room_name } = req.query; // Accessing query parameters
  mysql.query(
    `SELECT count(*) as count
     FROM room_agent_animal
     WHERE room_name = ? AND agent_name = ? and active =1`,
    [room_name, agent_name],
    (error, results, fields) => {
      if (error) {
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
      res.json(results);
    }
  );
});

app.post("/updateTime", async (request, response) => {
  const { agent_name, room_name } = request.body;
  console.log("cadcasdc", agent_name, room_name);
  mysql.query(
    `UPDATE room_agent_animal
    SET updated_date = NOW() 
    WHERE agent_name = ? AND room_name = ?;
    `,
    [agent_name, room_name],
    (error, results, fields) => {
      if (error) {
        response.status(500).json({ error: "Internal Server Error" });
        return;
      }
      response.json(results);
    }
  );
});

app.get("/GetRoomData", (req, res) => {
  mysql.query(
    `SELECT 
    x.room_name, 
    SUM(IF(y.agent_name IS NULL, 0, 1)) AS agent_count  
FROM 
    (SELECT r.name AS room_name FROM room AS r) AS x
LEFT JOIN 
    (SELECT ra.room_name, ra.agent_name FROM room_agent_animal AS ra WHERE ra.active = 1) AS y
ON 
    x.room_name = y.room_name
GROUP BY 
    x.room_name;
`,
    (error, results, fields) => {
      if (error) {
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
      res.json(results);
    }
  );
});

app.post("/GetAgentName", (req, res) => {
  const { room_name } = req.body;
  mysql.query(
    `SELECT 
    b.num,
    c.room_name,
    (CASE WHEN c.agent_name IS NULL THEN b.agent_name ELSE c.agent_name END) AS agent_name,
    (CASE WHEN c.agent_name IS NULL THEN 'Pending' ELSE 'Joined' END) AS Status,
    c.animal,
    updated_date
  FROM (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY a.agent_name) AS num,
      a.agent_name 
    FROM (
      SELECT 'Player 1' AS agent_name FROM dual
      UNION
      SELECT 'Player 2' AS agent_name FROM dual
      UNION
      SELECT 'Player 3' AS agent_name FROM dual
    ) AS a
  ) AS b 
  LEFT JOIN (
    SELECT ROW_NUMBER() OVER (ORDER BY ra.agent_name) AS num, agent_name, animal , room_name 
    ,updated_date FROM 
    room_agent_animal AS ra WHERE ra.room_name = ? and ra.active =1
  ) AS c ON b.num = c.num
  order by updated_date desc`,
    [room_name],
    (error, results, fields) => {
      if (error) {
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
      res.json(results);
    }
  );
});

http.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
