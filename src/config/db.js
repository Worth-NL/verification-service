import Sequelize from 'sequelize';
import dotenv from "dotenv"

dotenv.config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'postgres',
    });

sequelize.sync({ force: false })
    .then(() => {
        console.log('Database synchronized');
    })
    .catch((error) => {
        console.error('Failed to synchronize database:', error);
    });

export default sequelize;

// Old connection config
// const { Pool } = pkg;
//
// const pool = new Pool({
//     user: process.env.DB_USER,
//     host: process.env.DB_HOST,
//     database: process.env.DB_NAME,
//     password: process.env.DB_PASSWORD,
//     port: process.env.DB_PORT
// });

// pool.on("connect", () => {
//     console.log("Connection pool with db established");
// });

// export default pool;