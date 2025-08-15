import express from "express";
import EmailVerificationRequest from "../models/emailVerificationRequest.js";

const router = express.Router();
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// List
router.get("/", async (req, res) => {
    try {
        const emailVerificationRequests = await EmailVerificationRequest.findAll();
        res.json(emailVerificationRequests);
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: 'Failed to fetch Email Verification Request.' });
    }
});

// Create
router.post("/", async (req, res) => {
    try {
        const verificationCode = generateVerificationCode();

        const emailVerificationRequest = await EmailVerificationRequest.create({
            ...req.body,
            verificationCode
        });

        res.json({
            message: "Email Verification Request created successfully.",
            email: emailVerificationRequest.email
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get request by ID
router.get('/:id', async (req, res) => {
    try {
        const emailVerificationRequest = await EmailVerificationRequest.findByPk(req.params.id);
        if (!emailVerificationRequest) {
            res.status(404).json({ message: 'Email Verification Request not found.' });
        } else {
            res.json(emailVerificationRequest);
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch Email Verification Request.' });
    }
});

// Validate 
router.put('/validate', async (req, res) => {
    const verificationCode = req.body.verifciationCode;

    try {
        const emailVerificationRequest = await EmailVerificationRequest.findOne({
            where: { email: req.body.email }
        });

        console.log(verificationCode)
        console.log(emailVerificationRequest.verificationCode);

        if (!emailVerificationRequest) {
            return res.status(404).json({ message: 'Email Verification Request not found.' });
        }

        if (emailVerificationRequest.verificationCode === verificationCode) {
            console.log("correct code!");

            // Set isVerified = true
            emailVerificationRequest.isVerified = true;

            // Save to DB
            await emailVerificationRequest.save();

            return res.json({ message: "Email verified successfully.", emailVerificationRequest });
        } else {
            console.log("wrong code!");
            return res.status(400).json({ message: "Invalid verification code." });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to validate Email Verification Request.' });
    }
});

// Update 
router.put('/:id', async (req, res) => {
    try {
        const [updatedRowsCount] = await EmailVerificationRequest.update(req.body, {
            where: { id: req.params.id }
        });
        if (updatedRowsCount === 0) {
            res.status(404).json({ message: 'Email Verification Request not found.' });
        } else {
            const emailVerificationRequest = await EmailVerificationRequest.findByPk(req.params.id);
            res.json(emailVerificationRequest);
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to update Email Verification Request.' });
    }
});

// Delete 
router.delete('/:id', async (req, res) => {
    try {
        const deletedRowsCount = await EmailVerificationRequest.destroy({ where: { id: req.params.id } });
        if (deletedRowsCount === 0) {
            res.status(404).json({ message: 'Email Verification Request not found.' });
        } else {
            res.json({ message: 'Email Verification Request deleted successfully.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete Email Verification Request.' });
    }
});

export default router;