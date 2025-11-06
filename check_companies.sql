-- Check all companies in the database
SELECT id, name, email, "tenantId", "createdAt" 
FROM companies 
ORDER BY "createdAt" DESC;

-- Count companies by tenant
SELECT "tenantId", COUNT(*) as count
FROM companies
GROUP BY "tenantId";
