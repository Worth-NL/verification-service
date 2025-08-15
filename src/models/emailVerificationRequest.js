import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const EmailVerificationRequest = sequelize.define('emailVerificationRequest', {
    email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: {
            msg: "Validation already requested for this email address"
        },
        validate: {
            isEmail: true,
        },
    },
    origin: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    sessionHash: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    verificationCode: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    isVerified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    createdOn: {
        type: Sequelize.DATE,
        defaultValue: DataTypes.NOW,
    }
});

export default EmailVerificationRequest;