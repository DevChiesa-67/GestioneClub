# create-structure.ps1

$folders = @(
  "src",
  "src/app",

  "src/components",
  "src/components/auth",
  "src/components/ui",
  "src/components/cards",
  "src/components/tables",
  "src/components/charts",
  "src/components/forms",
  "src/components/layout",

  "src/hooks",
  "src/lib",
  "src/styles",
  "src/types"
)

foreach ($folder in $folders) {
  New-Item -ItemType Directory -Force -Path $folder | Out-Null
}

$files = @(
  "src/components/auth/LoginCard.tsx",
  "src/components/auth/LoginBackground.tsx",
  "src/components/auth/LoginLogo.tsx",
  "src/components/auth/LoginForm.tsx",

  "src/components/ui/Button.tsx",
  "src/components/ui/Input.tsx",
  "src/components/ui/PasswordInput.tsx",
  "src/components/ui/Checkbox.tsx",
  "src/components/ui/Select.tsx",
  "src/components/ui/TextArea.tsx",
  "src/components/ui/Badge.tsx",
  "src/components/ui/Avatar.tsx",
  "src/components/ui/Modal.tsx",
  "src/components/ui/Drawer.tsx",
  "src/components/ui/Tabs.tsx",
  "src/components/ui/EmptyState.tsx",

  "src/components/cards/AppCard.tsx",
  "src/components/cards/StatCard.tsx",
  "src/components/cards/PlayerCard.tsx",
  "src/components/cards/MatchCard.tsx",
  "src/components/cards/TrainingCard.tsx",

  "src/components/tables/DataTable.tsx",

  "src/components/charts/LineChart.tsx",
  "src/components/charts/RadarChart.tsx",
  "src/components/charts/Heatmap.tsx",

  "src/components/layout/Sidebar.tsx",
  "src/components/layout/Topbar.tsx",
  "src/components/layout/Breadcrumb.tsx",
  "src/components/layout/AppShell.tsx",

  "src/lib/theme.ts",
  "src/lib/navigation.ts",
  "src/types/index.ts"
)

foreach ($file in $files) {
  if (!(Test-Path $file)) {
    New-Item -ItemType File -Force -Path $file | Out-Null
  }
}

Write-Host "Struttura creata correttamente."