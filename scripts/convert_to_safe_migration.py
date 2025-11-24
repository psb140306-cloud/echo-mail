import re

def make_safe(sql_content):
    lines = sql_content.split('\n')
    new_lines = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Handle CREATE TYPE (Enum)
        if line.strip().startswith('CREATE TYPE'):
            # Extract type name
            match = re.search(r'CREATE TYPE "([^"]+)"', line)
            if match:
                type_name = match.group(1)
                # Collect the full statement (it might span multiple lines)
                stmt = line
                while ';' not in stmt and i + 1 < len(lines):
                    i += 1
                    stmt += '\n' + lines[i]
                
                # Wrap in DO block
                enum_def = stmt.split('AS ENUM')[1].strip().rstrip(';')
                new_lines.append(f"""DO $$ BEGIN
    CREATE TYPE "{type_name}" AS ENUM {enum_def};
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;""")
            else:
                new_lines.append(line)
        
        # Handle CREATE TABLE
        elif line.strip().startswith('CREATE TABLE'):
            # Add IF NOT EXISTS
            new_line = line.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS')
            new_lines.append(new_line)
            
        # Handle CREATE INDEX
        elif line.strip().startswith('CREATE INDEX') or line.strip().startswith('CREATE UNIQUE INDEX'):
            # Add IF NOT EXISTS
            if 'INDEX' in line and 'IF NOT EXISTS' not in line:
                # Postgre syntax: CREATE [UNIQUE] INDEX [IF NOT EXISTS] name ON ...
                # We need to insert IF NOT EXISTS after INDEX
                parts = line.split('INDEX ')
                new_line = parts[0] + 'INDEX IF NOT EXISTS ' + parts[1]
                new_lines.append(new_line)
            else:
                new_lines.append(line)
                
        # Handle ALTER TABLE ... ADD CONSTRAINT
        elif line.strip().startswith('ALTER TABLE') and 'ADD CONSTRAINT' in line:
            # Extract table name and constraint name
            # Format: ALTER TABLE "table" ADD CONSTRAINT "constraint" ...
            table_match = re.search(r'ALTER TABLE "([^"]+)"', line)
            constraint_match = re.search(r'ADD CONSTRAINT "([^"]+)"', line)
            
            if table_match and constraint_match:
                table_name = table_match.group(1)
                constraint_name = constraint_match.group(1)
                
                # Collect full statement
                stmt = line
                while ';' not in stmt and i + 1 < len(lines):
                    i += 1
                    stmt += '\n' + lines[i]
                
                # Wrap in DO block
                new_lines.append(f"""DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '{constraint_name}') THEN
        {stmt}
    END IF;
END
$$;""")
            else:
                new_lines.append(line)
        
        else:
            new_lines.append(line)
            
        i += 1
        
    return '\n'.join(new_lines)

# Read input
with open('manual_migration.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Process
safe_content = make_safe(content)

# Write output
with open('safe_migration.sql', 'w', encoding='utf-8') as f:
    f.write(safe_content)

print("Created safe_migration.sql")
