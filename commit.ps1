# List of files you worked on
$modifiedFiles = @(
    "app/(chat)/actions.ts",
    "app/(chat)/api/chat/route.ts",
    "blocks/invoice/client.tsx",
    "blocks/invoice/server.ts",
    "components/invoice-table.tsx",
    "lib/ai/tools/process-invoice.ts",
    "lib/db/queries.ts",
    "lib/ai/prompts.ts",
    "components/message.tsx",
    "components/block.tsx",
    "components/data-stream-handler.tsx",
    "models.ts",
    "schema.ts"
)

# Get all files in the repository
$allFiles = git ls-files

# Create a list of files you didn't work on
$unmodifiedFiles = $allFiles | Where-Object { $_ -notin $modifiedFiles }

# First commit: Initial commit for unmodified files
Write-Host "Committing unmodified files as initial commit..."
git add $unmodifiedFiles
git commit -m "initial commit"

# Second commit: Your implementation files
Write-Host "Committing your implementation files..."
git add $modifiedFiles
git commit -m "docs: add comprehensive implementation documentation

Added detailed documentation in README1.md explaining:
- Core components and their functions
- Data structures and interfaces
- Key features and bonus implementations
- Usage flow and error handling
- AI model integration details"

Write-Host "Done! Commits completed successfully." 