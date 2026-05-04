-- Migration to support withdrawal review process
-- Run in Supabase SQL Editor

-- 1. Add new statuses to WithdrawalStatus enum
ALTER TYPE WithdrawalStatus ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE WithdrawalStatus ADD VALUE IF NOT EXISTS 'REJECTED';

-- 2. Add failure_reason column if it doesn't exist (already exists in some patches, but just in case)
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- 3. Ensure audit_logs track these changes
-- (Optional, but good practice)
