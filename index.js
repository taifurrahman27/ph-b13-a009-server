const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
const dontenv = require("dotenv");
dontenv.config();
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

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



const JWKS = createRemoteJWKSet(
    new URL("http://localhost:3000/api/auth/jwks")
);

const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).send({
                message: "Unauthorized access",
            });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).send({
                message: "Token not found",
            });
        }

        const { payload } = await jwtVerify(token, JWKS);

        req.user = payload;

        console.log(payload, "payload");

        next();
    } catch (error) {
        console.error(error);

        return res.status(401).send({
            message: "Invalid or expired token",
        });
    }
};


async function run() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");

        const db = client.db("studynook");
        const roomCollection = db.collection("rooms");
        const bookingCollection = db.collection("bookings");



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

        app.get("/rooms/:id", verifyToken, async (req, res) => {
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
                    seatCapacity,
                    hourlyRate,
                    amenities,
                } = roomData;

                if (
                    !roomName ||
                    !description ||
                    !image ||
                    !floor ||
                    !seatCapacity ||
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



        app.patch("/rooms/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const updatedRoom = req.body;

                const filter = {
                    _id: new ObjectId(id),
                };

                const updateDoc = {
                    $set: {
                        roomName: updatedRoom.roomName,
                        image: updatedRoom.image,
                        description: updatedRoom.description,
                        floor: updatedRoom.floor,
                        seatCapacity: updatedRoom.seatCapacity,
                        hourlyRate: updatedRoom.hourlyRate,
                        amenities: updatedRoom.amenities,
                    },
                };

                const result = await roomCollection.updateOne(
                    filter,
                    updateDoc
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Room not found",
                    });
                }

                res.status(200).json({
                    success: true,
                    message: "Room updated successfully",
                    modifiedCount: result.modifiedCount,
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    success: false,
                    message: "Failed to update room",
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


        app.get("/bookings/:userId", async (req, res) => {
            try {
                const { userId } = req.params;

                if (!ObjectId.isValid(userId)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid user ID",
                    });
                }

                const bookings = await bookingCollection
                    .find({
                        userId: new ObjectId(userId),
                    })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).json({
                    success: true,
                    count: bookings.length,
                    data: bookings,
                });

            } catch (error) {
                console.error("FETCH BOOKINGS ERROR:", error);

                res.status(500).json({
                    success: false,
                    message: "Failed to fetch bookings",
                });
            }
        });




        app.post("/bookings", async (req, res) => {
            try {
                const {
                    userId,
                    userName,
                    userImage,
                    roomId,
                    roomName,
                    roomImage,
                    bookingDate,
                    startTime,
                    endTime,
                    specialNote
                } = req.body;

                const startHour = Number(startTime.split(":")[0]);
                const endHour = Number(endTime.split(":")[0]);

                const room = await roomCollection.findOne({
                    _id: new ObjectId(roomId)
                });

                if (!room) {
                    return res.status(404).json({ message: "Room not found" });
                }

                const conflict = await bookingCollection.findOne({
                    roomId: new ObjectId(roomId),
                    bookingDate,
                    status: "confirmed",
                    $expr: {
                        $and: [
                            { $lt: ["$startHour", endHour] },
                            { $gt: ["$endHour", startHour] }
                        ]
                    }
                });

                if (conflict) {
                    return res.status(409).json({
                        message: "Time slot already booked"
                    });
                }

                const booking = {
                    roomId: new ObjectId(roomId),
                    userId: new ObjectId(userId),

                    userName,
                    userImage,

                    roomName,
                    roomImage,

                    bookingDate,
                    startTime,
                    endTime,
                    startHour,
                    endHour,

                    hourlyRate: room.hourlyRate,
                    totalCost: (endHour - startHour) * room.hourlyRate,

                    specialNote: specialNote || "",
                    status: "confirmed",
                    createdAt: new Date()
                };

                const result = await bookingCollection.insertOne(booking);

                res.status(201).json({
                    success: true,
                    bookingId: result.insertedId
                });

            } catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Server error"
                });
            }
        });


        app.patch("/bookings/:id/cancel", async (req, res) => {
            try {
                const { id } = req.params;

                const result = await bookingCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: "cancelled" } }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Booking not found"
                    });
                }

                res.json({
                    success: true,
                    message: "Booking cancelled"
                });

            } catch (error) {
                console.error(error);
                res.status(500).json({
                    success: false,
                    message: "Server error while cancelling"
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
