const express = require("express");
var cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

const corsConfig = {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};

app.use(cors(corsConfig));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wnk3oaq.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const database = client.db("sclsDB");
    const usersCollection = database.collection("users");
    const classesCollection = database.collection("classes");
    const instructorsCollection = database.collection("instructors");
    const cartCollection = database.collection("carts");

    /**
     * * JWT Authentication
     */
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    /**
     * * User Router
     */

    // * Get all user from DB
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // * Insert User info into database
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser && existingUser.email) {
        return res.send({ message: "User Exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // * Update user role
    app.patch("/users/:id", async (req, res) => {
      const userID = req.params.id;
      const updateInfo = req.body;

      const query = { _id: new ObjectId(userID) };
      const updateDoc = {
        $set: {
          role: updateInfo.role,
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    /**
     * * User Router End
     */

    /**
     * * Course Router
     */
    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    // * Update Class Information
    app.patch("/classes/update/:id", async (req, res) => {
      const courseID = req.params.id;
      const updateCourse = req.body;

      const filter = { _id: new ObjectId(courseID) };
      const updateDoc = {
        $set: {
          availableSeats: updateCourse.availableSeats,
          enrolledStudents: updateCourse.enrolledStudents,
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    /**
     * * Instructors Router
     */
    app.get("/instructors", async (req, res) => {
      const result = await instructorsCollection.find().toArray();
      res.send(result);
    });

    /**
     * * Cart Router
     */

    // * Get all carts data
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    // * Insert enrolled course into DB
    app.post("/carts", async (req, res) => {
      const course = req.body;
      const result = await cartCollection.insertOne(course);
      res.send(result);
    });

    // * Delete Course from cart
    app.delete("/carts/:id", async (req, res) => {
      const courseID = req.params.id;
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { _id: new ObjectId(courseID), email: email };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
