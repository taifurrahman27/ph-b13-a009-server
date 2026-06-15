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
                    roomId,
                    userId,
                    userName,
                    userImage,
                    bookingDate,
                    startTime,
                    endTime,
                    specialNote
                } = req.body;

                if (!ObjectId.isValid(roomId) || !ObjectId.isValid(userId)) {
                    return res.status(400).json({
                        message: "Invalid room or user ID"
                    });
                }

                const startHour = Number(startTime.split(":")[0]);
                const endHour = Number(endTime.split(":")[0]);

                if (endHour <= startHour) {
                    return res.status(400).json({
                        message: "End time must be after start time"
                    });
                }

                if (startHour < 8 || endHour > 20) {
                    return res.status(400).json({
                        message: "Booking allowed only between 08:00 - 20:00"
                    });
                }

                const today = new Date();
                const selectedDate = new Date(bookingDate);

                today.setHours(0, 0, 0, 0);
                selectedDate.setHours(0, 0, 0, 0);

                if (selectedDate < today) {
                    return res.status(400).json({
                        message: "You cannot book a past date"
                    });
                }

                const room = await roomCollection.findOne({
                    _id: new ObjectId(roomId)
                });

                if (!room) {
                    return res.status(404).json({
                        message: "Room not found"
                    });
                }

                const hourlyRate = room.hourlyRate;

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
                        message: "This time slot is already booked"
                    });
                }

                const totalHours = endHour - startHour;
                const totalCost = totalHours * hourlyRate;

                const booking = {
                    roomId: new ObjectId(roomId),
                    userId: new ObjectId(userId),

                    userName,
                    userImage,

                    bookingDate,

                    startTime,
                    endTime,
                    startHour,
                    endHour,

                    hourlyRate,
                    totalCost,

                    specialNote: specialNote || "",

                    status: "confirmed",
                    createdAt: new Date()
                };

                const duplicate = await bookingCollection.findOne({
                    roomId: new ObjectId(roomId),
                    userId: new ObjectId(userId),
                    bookingDate,
                    startHour,
                    endHour
                });

                if (duplicate) {
                    return res.status(409).json({
                        message: "You already booked this slot"
                    });
                }
                const result = await bookingCollection.insertOne(booking);

                res.status(201).json({
                    success: true,
                    message: "Room booked successfully!",
                    bookingId: result.insertedId
                });

            } catch (error) {
                console.error("BOOKING ERROR:", error);

                res.status(500).json({
                    success: false,
                    message: "Server error while booking"
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
