const { Sequelize, Model, DataTypes, Deferrable } = require('sequelize');
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite'
});

class Record extends Model { }
Record.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING
    },
    time: {
        type: DataTypes.BIGINT
    }
}, { sequelize, modelName: 'record' });

module.exports = {
    init: async function () {
        await sequelize.sync();
    },
    registerRecord: async function (username, seconds) {
        await Record.create({
            username: username,
            time: seconds
        });
    },
    getTopThree: async function () {
        return await Record.findAll({
            order: [['time', 'ASC']],
            limit: 3
        })
    }
}
