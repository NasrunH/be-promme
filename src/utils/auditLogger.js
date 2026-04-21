const supabase = require('../config/supabase');

/**
 * Log an administrative action to the audit_logs table.
 * @param {Object} req - The Express request object (to extract user/ip)
 * @param {String} action - The action performed (e.g., 'HOLD_WALLET', 'INVALIDATE_SUBMISSION')
 * @param {String} entity_type - The type of entity affected (e.g., 'WALLET', 'SUBMISSION')
 * @param {String} entity_id - The UUID of the entity
 * @param {Object} old_data - Previous state (optional)
 * @param {Object} new_data - New state (optional)
 */
const logAudit = async (req, action, entity_type, entity_id, old_data = null, new_data = null) => {
    try {
        const actor_id = req.user?.id; // From authMiddleware
        const ip_address = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        const { error } = await supabase.from('audit_logs').insert({
            actor_id,
            actor_type: 'ADMIN',
            action,
            entity_type,
            entity_id,
            old_data,
            new_data,
            ip_address
        });

        if (error) {
            console.error('Audit Log Insertion Error:', error);
        }
    } catch (e) {
        console.error('Unexpected Audit Logging Error:', e);
    }
};

module.exports = { logAudit };
