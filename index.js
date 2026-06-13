const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
const dontenv = require("dotenv");
dontenv.config();
const cors = require("cors");

app.use(cors());
app.use(express.json());



app.get('/', (req, res) => {
    res.send('Studynook server is running fine on PORT')
})


const uri = process.env.MONGODB_URI;


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");

        const db = client.db("studynook")
        const roomCollection = db.collection("rooms")


        app.get("/rooms", async (req, res) => {
            try {
                const rooms = await roomCollection
                    .find()
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).json(rooms);
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    success: false,
                    message: "Failed to fetch rooms.",
                });
            }
        });


        app.get("/rooms/latest", async (req, res) => {
            try {
                const rooms = await roomCollection
                    .find()
                    .sort({ createdAt: -1 })
                    .limit(6)
                    .toArray();

                res.status(200).json(rooms);
            } catch (error) {
                res.status(500).json({
                    message: "Failed to fetch rooms.",
                });
            }
        });


        const { ObjectId } = require("mongodb");

        app.get("/rooms/:id", async (req, res) => {
            try {
                const id = req.params.id;

                const room = await roomCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!room) {
                    return res.status(404).send({
                        message: "Room not found",
                    });
                }

                res.send(room);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to fetch room",
                });
            }
        });


        app.post("/rooms", async (req, res) => {
            try {
                const roomData = req.body;

                const {
                    roomName,
                    description,
                    image,
                    floor,
                    capacity,
                    hourlyRate,
                    amenities,
                } = roomData;

                if (
                    !roomName ||
                    !description ||
                    !image ||
                    !floor ||
                    !capacity ||
                    !hourlyRate
                ) {
                    return res.status(400).json({
                        message: "All fields are required.",
                    });
                }

                if (
                    !Array.isArray(amenities) ||
                    amenities.length === 0
                ) {
                    return res.status(400).json({
                        message:
                            "Please select at least one amenity.",
                    });
                }

                const result =
                    await roomCollection.insertOne(roomData);

                res.status(201).json({
                    success: true,
                    insertedId: result.insertedId,
                    message: "Room added successfully.",
                });

            } catch (error) {
                console.error(error);

                res.status(500).json({
                    success: false,
                    message: "Internal server error.",
                });
            }
        });


        app.delete("/rooms/:id", async (req, res) => {
            try {
                const { id } = req.params;

                const result = await roomCollection.deleteOne({
                    _id: new ObjectId(id),
                });

                if (result.deletedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Room not found",
                    });
                }

                res.json({
                    success: true,
                    message: "Room deleted successfully",
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Failed to delete room",
                });
            }
        });




        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);





app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
})
