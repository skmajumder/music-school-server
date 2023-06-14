const express = require("express");
var cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const SSLCommerzPayment = require("sslcommerz-lts");

const app = express();
const port = process.env.PORT || 3000;

// * JWT Middleware - Verify the jwt token, is it valid or not
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  // * authorization header is not exist
  if (!authorization) {
    return res.status(401).send({
      error: true,
      status: 401,
      message: "Unauthorized Access: Authorization header not exist",
    });
  }
  // * authorization header exist, and have the token; which is generated when user login
  const token = authorization.split(" ")[1];
  // * after get authorization token from client, now we need to verify that is it valid or not
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({
        error: true,
        status: 401,
        message: "Unauthorized Access: Invalid token",
      });
    }
    req.decoded = decoded;
    next();
  });
};

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

const store_id = process.env.SSLCOMMERZ_STORE_ID;
const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD;
const is_live = false;

async function run() {
  try {
    // await client.connect();

    const database = client.db("sclsDB");
    const usersCollection = database.collection("users");
    const classesCollection = database.collection("classes");
    const instructorsCollection = database.collection("instructors");
    const cartCollection = database.collection("carts");
    const ordersCollection = database.collection("orders");

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
     * ! always use verifyJWT before verifyAdmin
     * * Verify Admin
     */
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({
          error: true,
          status: 403,
          admin: false,
          message: "Forbidden Access: User is not Admin, refuses to authorize",
        });
      }
      next();
    };

    /**
     * ! always use verifyJWT before verifyInstructor
     * * Verify Instructor
     */
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res.status(403).send({
          error: true,
          status: 403,
          instructor: false,
          message: "Forbidden Access: User is not Admin, refuses to authorize",
        });
      }
      next();
    };

    /**
     * * User Router
     */

    // * Get all user from DB
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // * Get admin from DB
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      const decodedEmail = req.decoded.email;
      if (decodedEmail !== email) {
        return res.status(403).send({
          error: true,
          status: 403,
          admin: false,
          message: "Forbidden Access: User is not Admin, refuses to authorize",
        });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // * Get instructor from DB
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      const decodedEmail = req.decoded.email;
      if (decodedEmail !== email) {
        return res.status(403).send({
          error: true,
          status: 403,
          instructor: false,
          message:
            "Forbidden Access: User is not Instructor, refuses to authorize",
        });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    // * Get student from DB
    app.get("/users/student/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      const decodedEmail = req.decoded.email;
      if (decodedEmail !== email) {
        return res.status(403).send({
          error: true,
          status: 403,
          student: false,
          message:
            "Forbidden Access: User is not student, refuses to authorize",
        });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { student: user?.role === "student" };
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

    app.get("/classes/:id", verifyJWT, verifyInstructor, async (req, res) => {
      const courseID = req.params.id;
      const email = req.query.email;
      // * Verifying the email
      const decodedEmail = req.decoded.email;
      if (decodedEmail !== email) {
        return res.status(403).send({
          error: true,
          status: 403,
          message:
            "Forbidden Access: Token is not valid for the user, refuses to authorize",
        });
      }
      const query = { _id: new ObjectId(courseID) };
      const result = await classesCollection.findOne(query);
      res.send(result);
    });

    app.post("/classes", verifyJWT, verifyInstructor, async (req, res) => {
      const newCourse = req.body;
      const email = newCourse.instructorEmail;
      // * Verifying the email
      const decodedEmail = req.decoded.email;
      if (decodedEmail !== email) {
        return res.status(403).send({
          error: true,
          status: 403,
          message:
            "Forbidden Access: Token is not valid for the user, refuses to authorize",
        });
      }
      const result = await classesCollection.insertOne(newCourse);
      res.send(result);
    });

    app.patch(
      "/classes/update/:id",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const courseID = req.params.id;
        const updateCourse = req.body;
        const email = updateCourse.instructorEmail;
        // * Verifying the email
        const decodedEmail = req.decoded.email;
        if (decodedEmail !== email) {
          return res.status(403).send({
            error: true,
            status: 403,
            message:
              "Forbidden Access: Token is not valid for the user, refuses to authorize",
          });
        }
        const filter = { _id: new ObjectId(courseID) };
        const updateDoc = {
          $set: {
            className: updateCourse.className,
            details: updateCourse.details,
            availableSeats: updateCourse.availableSeats,
            price: updateCourse.price,
            startDate: updateCourse.startDate,
          },
        };
        const result = await classesCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    // * Update class status
    app.patch("/classes/status/:id", verifyJWT, async (req, res) => {
      const courseID = req.params.id;
      const updateInfo = req.body;
      const filter = { _id: new ObjectId(courseID) };
      const updateDoc = {
        $set: {
          status: updateInfo.status,
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // * Update class Feedback
    app.patch("/classes/feedback/:id", verifyJWT, async (req, res) => {
      const courseID = req.params.id;
      const courseUpdate = req.body;
      const filter = { _id: new ObjectId(courseID) };
      const updateDoc = {
        $set: {
          feedback: courseUpdate.feedback,
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
    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }

      /**
       * *  Get user token, and check the token is valid for the current user, and the token is not for anyone else
       */
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({
          error: true,
          status: 403,
          message:
            "Forbidden Access: Token is not valid for the user, refuses to authorize",
        });
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

    /**
     * * Payment Route
     */

    const tran_id = new ObjectId().toString();

    app.post("/order/:id", async (req, res) => {
      const courseID = req.params.id;
      const orderInfo = req.body;

      const data = {
        total_amount: orderInfo.price,
        currency: "BDT",
        tran_id: tran_id, // use unique tran_id for each api call
        success_url: `https://b7a12-summer-camp-server-side-skmajumder.vercel.app/payment/success/${tran_id}`,
        fail_url: `https://b7a12-summer-camp-server-side-skmajumder.vercel.app/payment/failed/${tran_id}`,
        cancel_url: `https://b7a12-summer-camp-server-side-skmajumder.vercel.app/payment/failed/${tran_id}`,
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: orderInfo.courseName,
        product_category: "Music Class",
        product_profile: "general",
        cus_name: orderInfo.studentName,
        cus_email: orderInfo.studentEmail,
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };

      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });
        console.log("Redirecting to: ", GatewayPageURL);
      });

      const finalOrder = {
        ...orderInfo,
        paidStatus: false,
        tranId: tran_id,
      };
      const result = await ordersCollection.insertOne(finalOrder);
    });

    app.post("/payment/success/:tranId", async (req, res) => {
      const tranId = req.params.tranId;
      const result = await ordersCollection.updateOne(
        { tranId: tranId },
        {
          $set: {
            paidStatus: true,
          },
        }
      );

      if (result.modifiedCount > 0) {
        const course = await ordersCollection.findOne({ tranId: tranId });
        const classOne = await classesCollection.findOne({
          _id: new ObjectId(course.courseID),
        });

        const courseFilter = { _id: new ObjectId(course.courseID) };
        const courseUpdateDoc = {
          $set: {
            availableSeats: classOne.availableSeats - 1,
            enrolledStudents: classOne.enrolledStudents + 1,
          },
        };
        const courseUpdate = await classesCollection.updateOne(
          courseFilter,
          courseUpdateDoc
        );

        res.redirect(
          "https://summer-camp-school-891c4.web.app/dashboard/payment-success"
        );
      }
    });

    app.post("/payment/failed/:tranId", async (req, res) => {
      const tranId = req.params.tranId;
      const result = await ordersCollection.deleteOne({ tranId: tranId });

      if (result.deletedCount > 0) {
        res.redirect(
          "https://summer-camp-school-891c4.web.app/dashboard/payment-failed"
        );
      }
    });

    app.get("/orders", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }

      /**
       * *  Get user token, and check the token is valid for the current user, and the token is not for anyone else
       */
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({
          error: true,
          status: 403,
          message:
            "Forbidden Access: Token is not valid for the user, refuses to authorize",
        });
      }

      const query = { studentEmail: email };
      const result = await ordersCollection.find(query).toArray();
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
