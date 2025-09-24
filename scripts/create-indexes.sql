-- Additional Indexes for Echo Mail Database
-- These indexes improve query performance for common operations

-- Companies table indexes
CREATE INDEX idx_companies_region ON companies(region);
CREATE INDEX idx_companies_isActive ON companies(isActive);
CREATE INDEX idx_companies_createdAt ON companies(createdAt DESC);

-- Contacts table indexes
CREATE INDEX idx_contacts_companyId ON contacts(companyId);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_isActive ON contacts(isActive);

-- Email logs table indexes
CREATE INDEX idx_email_logs_companyId ON email_logs(companyId);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_receivedAt ON email_logs(receivedAt DESC);
CREATE INDEX idx_email_logs_sender ON email_logs(sender);

-- Full text search index for email subjects
CREATE INDEX idx_email_logs_subject_gin ON email_logs USING gin(to_tsvector('english', subject));

-- Notification logs table indexes
CREATE INDEX idx_notification_logs_companyId ON notification_logs(companyId);
CREATE INDEX idx_notification_logs_emailLogId ON notification_logs(emailLogId);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_type ON notification_logs(type);
CREATE INDEX idx_notification_logs_sentAt ON notification_logs(sentAt DESC);
CREATE INDEX idx_notification_logs_recipient ON notification_logs(recipient);

-- Composite indexes for common queries
CREATE INDEX idx_notification_logs_status_nextRetryAt ON notification_logs(status, nextRetryAt)
WHERE status IN ('PENDING', 'FAILED');

CREATE INDEX idx_email_logs_companyId_status ON email_logs(companyId, status);

-- Delivery rules table indexes
CREATE INDEX idx_delivery_rules_isActive ON delivery_rules(isActive);

-- Holidays table indexes
CREATE INDEX idx_holidays_date_extract_year ON holidays(EXTRACT(YEAR FROM date));
CREATE INDEX idx_holidays_isRecurring ON holidays(isRecurring);

-- System configs table indexes
CREATE INDEX idx_system_configs_category ON system_configs(category);

-- Message templates table indexes
CREATE INDEX idx_message_templates_type ON message_templates(type);
CREATE INDEX idx_message_templates_isActive ON message_templates(isActive);
CREATE INDEX idx_message_templates_isDefault ON message_templates(isDefault);

-- Users table indexes
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_isActive ON users(isActive);