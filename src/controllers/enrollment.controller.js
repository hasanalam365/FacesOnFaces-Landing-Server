const client = require("../config/db");

const enrollmentsCollection =
  client
    .db("facesOnFaces")
    .collection("enrollments");



exports.getEnrollments =
  async (req, res) => {

    try {

      const result =
        await enrollmentsCollection
          .find()
          .sort({
            createdAt: -1,
          })
          .toArray();

      res.send(result);

    } catch (error) {

      console.log(error);

      res.status(500).send({
        success: false,
        message:
          "Failed to fetch enrollments",
      });
    }
};