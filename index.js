const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.q3wt8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();    // Candidates collection
    const candidatesCollection = client
      .db("assignmentDB")
      .collection("candidates");
    const usersCollection = client.db("assignmentDB").collection("users");
    const tourCollection = client.db("assignmentDB").collection("tours");
    const cartCollection = client.db("assignmentDB").collection("carts");
    const storyCollection = client.db("assignmentDB").collection("story");
    const storiesCollection = client.db("assignmentDB").collection("stories");


    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });
      res.send({ token });
    });

    //  middleware
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify Admin after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // POST endpoint for submitting tour guide applications
    app.post("/candidates", verifyToken, async (req, res) => {
      try {
        const { title, reason, cvLink } = req.body;

        // Validate required fields
        if (!title || !reason || !cvLink) {
          return res.status(400).send({ message: "All fields are required." });
        }

        // Validate CV link (basic validation)
        const isValidURL = (url) => {
          const pattern = new RegExp(
            "^(https?:\\/\\/)" + // Protocol
              "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|" + // Domain name
              "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR IP (v4) address
              "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // Port and path
              "(\\?[;&a-z\\d%_.~+=-]*)?" + // Query string
              "(\\#[-a-z\\d_]*)?$",
            "i"
          );
          return !!pattern.test(url);
        };

        if (!isValidURL(cvLink)) {
          return res.status(400).send({ message: "Invalid CV link." });
        }

        // Extract user ID from JWT (already verified)
        const userId = req.decoded.id;
        const email = req.decoded.email;

        // Prepare the application data
        const application = {
          userId,
          name: req.decoded.displayName || "Anonymous",
          email,
          applicationTitle: title,
          applicationReason: reason,
          cvLink,
          applicationDate: new Date(),
          status: "Pending", // Default status
        };

        // Save the application to the database
        const result = await candidatesCollection.insertOne(application);

        res.status(200).send({
          message: "Your application has been submitted successfully.",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Error submitting application:", error);
        res.status(500).send({ message: "Failed to submit the application." });
      }
    });

    // carts collection
    app.get("/candidates",  async (req, res) => {
      const result = await candidatesCollection.find().toArray();
      res.send(result);
    });
    // carts collection
    app.get("/carts", verifyToken, async (req, res) => {
      const result = await cartCollection.find().toArray();
      res.send(result);
    });

    app.post("/carts", verifyToken, async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    // user story
    app.post("/story", verifyToken, async (req, res) => {
      const storyItem = req.body;
      const result = await storyCollection.insertOne(storyItem);
      res.send(result);
    });

    // story related api
    app.get("/story",  async (req, res) => {
      const result = await storyCollection.find().toArray();
      res.send(result);
    });

    app.delete("/story/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await storyCollection.deleteOne(query);
      res.send(result);
    });

    // guide story
    app.post("/stories", verifyToken, async (req, res) => {
      const storiesItem = req.body;
      const result = await storiesCollection.insertOne(storiesItem);
      res.send(result);
    });

    // story related api
    app.get("/stories", verifyToken, async (req, res) => {
      const result = await storiesCollection.find().toArray();
      res.send(result);
    });

    app.delete("/stories/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await storiesCollection.deleteOne(query);
      res.send(result);
    });


    // users related api
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.get("/users/guide/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let guide = false;
      if (user) {
        guide = user?.role === "guide";
      }
      res.send({ guide });
    });

    // users related api
    app.post("/users",verifyToken, async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.patch(
      "/users/admin/:id",
      verifyToken, verifyAdmin,

      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    app.patch("/users/guide/:id",
      verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "guide",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/users/:id", verifyToken, async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          photURL: item.photURL,
        },
      };

      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.post("/tours", verifyToken, async (req, res) => {
      const tourItem = req.body;
      const result = await tourCollection.insertOne(tourItem);
      res.send(result);
    });

    app.get("/tours", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await tourCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });
    app.delete("/candidates/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await candidatesCollection.deleteOne(query);
      res.send(result);
    });


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("assignment 12 is running on port");
});

app.listen(port, () => {
  console.log(`assignment 12 is running on port ${port}`);
});
