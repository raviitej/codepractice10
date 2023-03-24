const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initializeServerAndDbConnection = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {});
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};
initializeServerAndDbConnection();

//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const usernameQuery = `SELECT * FROM user WHERE username ='${username}';`;
  const is_checkUsername = await db.get(usernameQuery);
  if (is_checkUsername === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const checkPassword = await bcrypt.compare(
      password,
      is_checkUsername.password
    );
    if (checkPassword === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwToken = jwt.sign(payload, "my_secret_token");
      response.status(200);
      response.send({ jwtToken: jwToken });
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtTokens;
  const authHeader = request.header["Authorization"];
  if (authHeader !== undefined) {
    jwtTokens = authHeader.split()[1];
  }
  if (jwtTokens === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtTokens, "my_secret_token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// API
convertStatedata = (each) => {
  return {
    stateId: each.state_id,
    stateName: each.state_name,
    population: each.population,
  };
};

app.get("/states/", authenticateToken, async (request, response) => {
  const dbQuery = `SELECT * FROM state`;
  const stateData = await db.all(dbQuery);
  response.send(stateData.map((each) => convertStatedata(each)));
});

// API 2

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const dbQuery = `SELECT * FROM state WHERE state_id=${stateId}`;
  const stateDetails = await db.get(dbQuery);
  response.send(convertStatedata(stateDetails));
});

// API 3

app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const postQuery = `INSERT INTO  district (district_name,state_id,cases,cured,active,deaths) VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const postResponse = await db.run(postQuery);
  const dstId = postResponse.lastID;
  console.log(dstId);
  response.send("District Successfully Added");
});

// API4

const convertDistrictData = (each) => {
  return {
    districtId: each.district_id,
    districtName: each.district_name,
    stateId: each.state_id,
    cases: each.cases,
    cured: each.cured,
    active: each.active,
    deaths: each.deaths,
  };
};

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `SELECT * FROM district WHERE district_id = ${districtId}`;
    const districtHistory = await db.get(districtQuery);
    response.send(convertDistrictData(districtHistory));
  }
);

//API 5

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM
      district
    WHERE
      district_id = ${districtId};`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

// API 6

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const postQuery = `UPDATE district SET district_name = '${districtName}', state_id = ${stateId}, cases = ${cases},cured = ${cured}, active = ${active} ,deaths=${deaths}  WHERE district_id = ${districtID}`;
    await db.run(postQuery);
    response.send("District Details Updated");
  }
);

// API7
const staticalData = (each) => {
  return {
    totalCases: each["SUM(cases)"],
    totalCured: each["SUM(cured)"],
    totalActive: each["SUM(active)"],
    totalDeaths: each["SUM(deaths)"],
  };
};

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const dbQuery = `SELECT SUM(cases) ,SUM(cured) ,SUM(active) ,SUM(deaths) FROM district WHERE state_id = ${stateId}; `;
    const stateData = await db.all(dbQuery);
    response.send(stateData.map((each) => staticalData(each)));
  }
);

//API8
const states = (each) => {
  return {
    stateName: each.state_name,
  };
};

app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const dbQuery = `SELECT state_name  FROM district NATURAL JOIN state WHERE district_id = ${districtId}; `;
    const stateData = await db.all(dbQuery);
    response.send(stateData.map((each) => states(each)));
  }
);

module.exports = app;
