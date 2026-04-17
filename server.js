"use strict";

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");

const DB_NAME = process.env.DB_NAME || path.basename(__dirname);
const LISTS_COLLECTION = "lists";
const DEFAULT_URI = "mongodb://127.0.0.1:27017";

const mongoUri = process.env.MONGODB_URI || DEFAULT_URI;

function newEntryId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let client;
let db;

async function connect() {
  client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  db = client.db(DB_NAME);
  const lists = db.collection(LISTS_COLLECTION);
  await lists.createIndex({ title: 1 });
}

function listsCol() {
  return db.collection(LISTS_COLLECTION);
}

function sendServerError(res, message, err) {
  const details = err && err.message ? err.message : "Unknown server error";
  res.status(500).json({ error: message, details: details });
}

app.get("/api/lists", async (_req, res) => {
  try {
    const lists = await listsCol()
      .find({}, { projection: { title: 1 } })
      .sort({ title: 1 })
      .toArray();
    res.json(
      lists.map((doc) => ({
        id: doc._id.toString(),
        title: doc.title,
      }))
    );
  } catch (err) {
    console.error(err);
    sendServerError(res, "Failed to load lists", err);
  }
});

app.get("/api/lists/:id", async (req, res) => {
  try {
    let oid;
    try {
      oid = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ error: "Invalid list id" });
    }
    const doc = await listsCol().findOne({ _id: oid });
    if (!doc) return res.status(404).json({ error: "List not found" });
    res.json({
      id: doc._id.toString(),
      title: doc.title,
      entries: (doc.entries || []).map((e) => ({
        id: e.id,
        text: e.text,
        status: Boolean(e.status),
      })),
    });
  } catch (err) {
    console.error(err);
    sendServerError(res, "Failed to load list", err);
  }
});

app.post("/api/lists", async (req, res) => {
  try {
    const title =
      req.body && typeof req.body.title === "string" ? req.body.title.trim() : "";
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }
    const doc = {
      title,
      entries: [],
    };
    const result = await listsCol().insertOne(doc);
    res.status(201).json({
      id: result.insertedId.toString(),
      title,
      entries: [],
    });
  } catch (err) {
    console.error(err);
    sendServerError(res, "Failed to create list", err);
  }
});

app.post("/api/lists/:id/entries", async (req, res) => {
  try {
    let oid;
    try {
      oid = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ error: "Invalid list id" });
    }
    const text = req.body && typeof req.body.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }
    const entry = {
      id: newEntryId(),
      text,
      status: false,
    };
    const result = await listsCol().updateOne({ _id: oid }, { $push: { entries: entry } });
    if (result.matchedCount === 0) return res.status(404).json({ error: "List not found" });
    res.status(201).json({
      id: entry.id,
      text: entry.text,
      status: entry.status,
    });
  } catch (err) {
    console.error(err);
    sendServerError(res, "Failed to add entry", err);
  }
});

app.patch("/api/lists/:listId/entries/:entryId", async (req, res) => {
  try {
    let listOid;
    try {
      listOid = new ObjectId(req.params.listId);
    } catch {
      return res.status(400).json({ error: "Invalid list id" });
    }
    const entryId = req.params.entryId;
    const status = req.body && req.body.status;
    if (typeof status !== "boolean") {
      return res.status(400).json({ error: "status must be a boolean" });
    }
    const list = await listsCol().findOne({ _id: listOid });
    if (!list) return res.status(404).json({ error: "List not found" });
    const entries = list.entries || [];
    const idx = entries.findIndex((e) => e.id === entryId);
    if (idx === -1) return res.status(404).json({ error: "Entry not found" });
    entries[idx].status = status;
    await listsCol().updateOne({ _id: listOid }, { $set: { entries } });
    res.json({
      id: entries[idx].id,
      text: entries[idx].text,
      status: entries[idx].status,
    });
  } catch (err) {
    console.error(err);
    sendServerError(res, "Failed to update entry", err);
  }
});

app.delete("/api/lists/:listId/entries/:entryId", async (req, res) => {
  try {
    let listOid;
    try {
      listOid = new ObjectId(req.params.listId);
    } catch {
      return res.status(400).json({ error: "Invalid list id" });
    }
    const entryId = req.params.entryId;
    const list = await listsCol().findOne({ _id: listOid });
    if (!list) return res.status(404).json({ error: "List not found" });
    const before = list.entries || [];
    const after = before.filter((e) => e.id !== entryId);
    if (after.length === before.length) {
      return res.status(404).json({ error: "Entry not found" });
    }
    await listsCol().updateOne({ _id: listOid }, { $set: { entries: after } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    sendServerError(res, "Failed to delete entry", err);
  }
});

app.delete("/api/lists/:id", async (req, res) => {
  try {
    let oid;
    try {
      oid = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ error: "Invalid list id" });
    }
    const result = await listsCol().deleteOne({ _id: oid });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "List not found" });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    sendServerError(res, "Failed to delete list", err);
  }
});

const PORT = process.env.PORT || 3000;

console.log(`Connecting to MongoDB: ${mongoUri}`);
console.log(`Using database: ${DB_NAME}`);

connect()
  .then(() => {
    console.log("MongoDB connection successful.");
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
      console.log(`MongoDB database: ${DB_NAME}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    console.error("Set MONGODB_URI to a reachable MongoDB instance and restart.");
    process.exit(1);
  });

process.on("SIGINT", async () => {
  if (client) await client.close();
  process.exit(0);
});
