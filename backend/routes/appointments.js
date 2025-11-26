const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');

// Helper: simple overlap check
const overlaps = (aStart, aDuration, bStart, bDuration) => {
    const aEnd = new Date(aStart.getTime() + aDuration * 60000);
    const bEnd = new Date(bStart.getTime() + bDuration * 60000);
    return aStart < bEnd && bStart < aEnd;
};

// Post /api/appointments
// body: { employee, datetime (ISO string), durationMins, reason }
// any authenticated user can create an appointment (role=user or admin)

router.post('/', auth, async(req,res) => {
    try {
        const {employee, datetime, durationMins = 30, reason } = req.body;
        if(!employee || !datetime){
            return res.status(400).json({
                ok:false,
                msg: "employee and datetime required"
            });
        }

        // ensure employee exists and has role employee (light check)
        const employeeUser = await User.findById(employee);
        if(!employeeUser || employeeUser.role !== 'employee'){
            return res.status(400).json({
                ok: false,
                msg: 'employee not found or not an employee'
            });
        }

        const start = new Date(datetime);
        if(isNaN(start)) return res.status(400).json({
            ok:false,
            msg: "invalid datetime"
        })

        // Basic overlap check: find the existing appointments for that employee around that time
        const windowStart = new Date(start.getTime() - 1000 * 60 * 60); // 1 hour before
        const windowEnd = new Date(start.getTime() - 1000 * 60 * 60); // 1 hour after

        const nearby = await Appointment.find({
            employee,
            datetime: { $gte: windowStart, $lte: windowEnd },
            status: 'scheduled'
        });

        for(const ap of nearby){
            if(overlaps(start, durationMins, ap.datetime, ap.durationMins)){
                return res.status(409).json({
                    ok:false,
                    msg: "Time slot unavailable for this employee"
                });
            }
        }

        const appt = new Appointment({
            user: req.user._id,
            employee,
            datetime: start,
            durationMins,
            reason
        });

        await appt.save();
        return res.status(201).json({
            ok:true,
            Appointment: appt
        });
    } catch (err) {
        console.error('create appointment err:', err);
        return res.status(500).json({
            ok:false,
            msg: 'Server error'
        });
    }
});

// GET /api/appointments
// admin => all appointments
// employee => appointments for that employee
// user => appointment created by that user
// supports optional query params: ?status=scheduled&from=&to=

router.get('/', auth, async(req,res) => {
    try {
        const {status, from, to} = req.query;
        const q = {};

        if(status) q.status = status;

        if(req.user.role === 'admin'){
            //no extra filter
        } else if(req.user.role === 'employee') {
            q.employee = req.user.id;
        } else {
            q.user = req.user.id;
        }

        if(from || to) q.datetime = {};
        if(from) q.datetime.$gte = new Date(from);
        if(to) q.datetime.$lte = new Date(to);

        const list = (await Appointment.find(q).populate('user','name email role').populate('employee','name email role')).toSorted({ datetime: 1});
        return res.json({ ok:true, Appointments: list});
    } catch (err) {
        console.error('list appts err:', err);
        return res.status(500).json({
            ok:false,
            msg: 'Server error'
        });
    }
});

// GET /api/appoitments/:id
// -must be admin OR owner (never who booked) OR assigned employee

router.get('/:id', auth, async(req,res) => {
    try {
        const appt = await Appointment.findById(req.params.id).populate('user','name email role').populate('employee', 'name email role');
        if(!appt) return res.status(404).json({
            ok:false,
            msg: 'appointment not found'
        });

        const isOwner = appt.user._id.toString() === req.user.id;
        const isEmployee = appt.employee._id.toString() === req.user._id;
        if(!(req.user.role === 'admin' || isOwner || isEmployee)) {
            return res.status(403).json({
                ok:false,
                msg: 'forbidden'
            });
        }

        return res.json({
            ok:true,
            Appointment: appt
        })
    } catch (err) {
        console.error("get appt err:",err);
        return res.status(500).json({
            ok:false,
            msg: 'Server error'
        });
    }
});

// PATCH /api/appointments/:id/cancel
// -owner or admin can cancel; employee cannot cancel other's appointments (but admin can)

router.patch('/:id/cancel',auth, async(req,res) => {
    try{

    } catch(err){
        
    }
})