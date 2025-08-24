const express = require('express');
const pool = require('./db');
const router = express.Router();

const updateLead = async (id, fields) => {
    const columns = Object.keys(fields);
    if (columns.length === 0) {
        return null;
    }

    const setClauses = columns.map((col, index) => `"${col}" = $${index + 1}`);
    setClauses.push(`"updated_at" = NOW()`);
    
    const setString = setClauses.join(', ');
    const values = Object.values(fields);

    const query = `UPDATE Leads SET ${setString} WHERE id = $${columns.length + 1} RETURNING *`;
    const result = await pool.query(query, [...values, id]);
    
    return result.rows[0];
};

router.post('/', async (req, res) => {
    const {
        first_name, last_name, email, phone, company, city, state,
        source, status, score, lead_value
    } = req.body;

    if (!first_name || !last_name || !email) {
        return res.status(400).json({ message: 'First name, last_name, and email are required.' });
    }

    try {
        const newLead = await pool.query(
            `INSERT INTO Leads (first_name, last_name, email, phone, company, city, state, source, status, score, lead_value)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [first_name, last_name, email, phone, company, city, state, source, status, score, lead_value]
        );
        res.status(201).json(newLead.rows[0]);
    } catch (error) {
        console.error(error.message);
        if (error.code === '23505') {
            return res.status(400).json({ message: 'Email already exists for a lead.' });
        }
        res.status(500).json({ message: 'Server error while creating lead.' });
    }
});

router.get('/', async (req, res) => {
    const page = parseInt(req.query.page || '1', 10);
    let limit = parseInt(req.query.limit || '20', 10);
    if (limit > 100) limit = 100;
    const offset = (page - 1) * limit;

    const filters = req.query.filter || {};
    const whereClauses = [];
    const params = [];

    const operatorMap = { equals: '=', contains: 'ILIKE', gt: '>', lt: '<' };

    Object.entries(filters).forEach(([field, ops]) => {
        Object.entries(ops).forEach(([op, value]) => {
            let paramIndex = params.length + 1;
            switch (op) {
                case 'equals':
                case 'gt':
                case 'lt':
                    whereClauses.push(`"${field}" ${operatorMap[op]} $${paramIndex}`);
                    params.push(value);
                    break;
                case 'contains':
                    whereClauses.push(`"${field}" ${operatorMap[op]} $${paramIndex}`);
                    params.push(`%${value}%`);
                    break;
                case 'in':
                    const inValues = Array.isArray(value) ? value : [value];
                    const placeholders = inValues.map((_, i) => `$${paramIndex + i}`).join(', ');
                    whereClauses.push(`"${field}" IN (${placeholders})`);
                    params.push(...inValues);
                    break;
                case 'between':
                    const [start, end] = value.split(',');
                    whereClauses.push(`"${field}" BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
                    params.push(start, end);
                    break;
                case 'on':
                    whereClauses.push(`DATE_TRUNC('day', "${field}") = $${paramIndex}`);
                    params.push(value);
                    break;
                case 'before':
                    whereClauses.push(`"${field}" < $${paramIndex}`);
                    params.push(value);
                    break;
                case 'after':
                    whereClauses.push(`"${field}" > $${paramIndex}`);
                    params.push(value);
                    break;
            }
        });
    });

    let query = 'SELECT * FROM Leads';
    let countQuery = 'SELECT COUNT(*) FROM Leads';
    
    if (whereClauses.length > 0) {
        const whereString = ` WHERE ${whereClauses.join(' AND ')}`;
        query += whereString;
        countQuery += whereString;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    try {
        const totalResult = await pool.query(countQuery, params);
        const total = parseInt(totalResult.rows[0].count, 10);
        const leadsResult = await pool.query(query, [...params, limit, offset]);
        
        res.status(200).json({
            data: leadsResult.rows,
            page: page,
            limit: limit,
            total: total,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Server error while fetching leads.' });
    }
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const lead = await pool.query('SELECT * FROM Leads WHERE id = $1', [id]);
        if (lead.rows.length === 0) {
            return res.status(404).json({ message: 'Lead not found.' });
        }
        res.status(200).json(lead.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Server error while fetching lead.' });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const fieldsToUpdate = req.body;

    if (Object.keys(fieldsToUpdate).length === 0) {
        return res.status(400).json({ message: 'No fields to update provided.' });
    }

    try {
        const updatedLead = await updateLead(id, fieldsToUpdate);
        if (!updatedLead) {
            return res.status(404).json({ message: 'Lead not found.' });
        }
        res.status(200).json(updatedLead);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Server error while updating lead.' });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const deleteOp = await pool.query('DELETE FROM Leads WHERE id = $1 RETURNING id', [id]);
        if (deleteOp.rowCount === 0) {
            return res.status(404).json({ message: 'Lead not found.' });
        }
        res.status(204).send();
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Server error while deleting lead.' });
    }
});

module.exports = router;