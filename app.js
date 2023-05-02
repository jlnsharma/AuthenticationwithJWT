const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();

app.use(express.json());
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`error ${e.message}`);
  }
};

initializeDbAndServer();

const convertToRequired = (each) => {
  return {
    stateId: each.state_id,
    stateName: each.state_name,
    population: each.population,
  };
};

const convertToDistrictRequired = (each) => {
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

app.post("/login", async (request, response) => {
  let { username, password } = request.body;
  const userCheck = `select * from user where username =  '${username}';`;
  const userCheckData = await db.get(userCheck);
  // console.log(userCheckData);
  if (userCheckData === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passwordMatchCheck = await bcrypt.compare(
      password,
      userCheckData.password
    );
    if (passwordMatchCheck === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");

      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const logger = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    // console.log(authHeader.split(" "));
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
        //response.status(401);
      } else {
        next();
      }
    });
  }
};

app.get("/states/", logger, async (request, response) => {
  const query = `select * from state order by state_id;`;

  queryData = await db.all(query);

  response.send(queryData.map((each) => convertToRequired(each)));
});

app.get("/states/:stateId", logger, async (request, response) => {
  const { stateId } = request.params;
  const query = `select * from state  where  state_id = ${stateId};`;

  queryData = await db.get(query);

  response.send(convertToRequired(queryData));
});

app.post("/districts", logger, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const query = `insert into district(district_name,state_id,cases,cured,active,deaths) values('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  queryData = await db.run(query);

  response.send("District Successfully Added");
});

app.get("/districts/:districtId", logger, async (request, response) => {
  const { districtId } = request.params;
  const query = `select * from district  where  district_id = ${districtId};`;

  queryData = await db.get(query);

  response.send(convertToDistrictRequired(queryData));
});

app.delete("/districts/:districtId", logger, async (request, response) => {
  const { districtId } = request.params;
  const query = `delete  from district  where  district_id = ${districtId};`;

  queryData = await db.get(query);

  response.send("District Removed");
});

app.put("/districts/:districtId", logger, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const { districtId } = request.params;
  const query = `update district set district_name = '${districtName}'
  ,state_id = ${stateId},cases = ${cases},cured = ${cured},active = ${active},deaths= ${deaths}  where district_id = ${districtId};`;
  queryData = await db.run(query);

  response.send("District Details Updated");
});

app.get("/states/:stateId/stats", logger, async (request, response) => {
  const { stateId } = request.params;
  const query = `select sum(cases) as totalCases,
  sum(cured) as totalCured,
  sum(active) as totalActive, sum(deaths)  as totalDeaths from district  where  state_id = ${stateId};`;

  queryData = await db.get(query);

  response.send(queryData);
});

module.exports = app;
