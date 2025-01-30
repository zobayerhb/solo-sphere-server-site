require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vpupb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    await client.connect();
    const db = client.db("solo-db");
    const jobsCollection = db.collection("jobs");
    const bidsCollection = db.collection("allBids");

    // make a jobData in db

    app.get("/jobs", async (req, res) => {
      const result = await jobsCollection.find().toArray();
      res.send(result);
    });

    // get all jobs by specific email
    app.get("/jobs/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { "buyer.email": email };
      const result = await jobsCollection.find(filter).toArray();
      res.send(result);
    });

    // get job id for update job details
    app.get("/job/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(filter);
      res.send(result);
    });

    app.post("/add-job", async (req, res) => {
      const jobData = req.body;
      const result = await jobsCollection.insertOne(jobData);
      res.send(result);
    });

    // update job
    app.put("/update-job/:id", async (req, res) => {
      const id = req.params.id;
      const jobData = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateJob = {
        $set: jobData,
      };
      const options = { upsert: true };
      const result = await jobsCollection.updateOne(filter, updateJob, options);
      res.send(result);
    });

    //================= add bids data  =============
    app.post("/add-bids", async (req, res) => {
      const bidsData = req.body;
      // if alreay exists users bids
      const query = { email: bidsData.email, jobId: bidsData.jobId };
      const alreadyExists = await bidsCollection.findOne(query);
      if (alreadyExists) {
        return res.status(400).send("You have alreday bids in this job");
      }
      // bids save to bids collection
      const result = await bidsCollection.insertOne(bidsData);

      // increase bid count in jobs collection
      const filter = { _id: new ObjectId(bidsData.jobId) };
      const update = {
        $inc: {
          bid_count: 1,
        },
      };
      const jobBidsCount = await jobsCollection.updateOne(filter, update);

      res.send(result);
    });

    // get all bids jobs for specific user
    app.get("/bids/:email", async (req, res) => {
      const isBuyer = req.query.buyer;
      const email = req.params.email;

      let query = {};
      if (isBuyer) {
        query.buyer = email;
      } else {
        query.email = email;
      }
      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    });

    // get all jobs bids request for a buyer
    // app.get("/bids-request/:email", async (req, res) => {
    //   const email = req.params.email;
    //   const filter = { buyer: email };
    //   const result = await bidsCollection.find(filter).toArray();
    //   res.send(result);
    // });

    app.patch("/bid-state-update/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updated = {
        $set: { status },
      };
      const result = await bidsCollection.updateOne(filter, updated);
      res.send(result);
    });

    app.get("/all-jobs", async (req, res) => {
      const filter = req.query.filter;
      const search = req.query.search;
      const sort = req.query.sort;
      let options = {};
      if (sort) options = { sort: { deadline: sort === "asc" ? 1 : -1 } };
      let query = {
        title: {
          $regex: search,
          $options: "i", // options "i" make it case-insensitive & $regex use for search
        },
      }; // let query = { category: filter };
      if (filter) query.category = filter;
      const result = await jobsCollection.find(query, options).toArray();
      res.send(result);
    });

    // delete job from db
    app.delete("/job/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await jobsCollection.deleteOne(filter);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from SoloSphere Server....");
});

app.listen(port, () => console.log(`Server running on port ${port}`));
