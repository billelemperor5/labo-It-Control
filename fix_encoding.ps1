$content = Get-Content -Raw -Encoding UTF8 "script.js"

$content = $content.Replace("â€¢", "•")
$content = $content.Replace("Ã‰", "É")
$content = $content.Replace("Ã©", "é")
$content = $content.Replace("Ã¨", "è")
$content = $content.Replace("Ãª", "ê")
$content = $content.Replace("Ã§", "ç")
$content = $content.Replace("Ã®", "î")
$content = $content.Replace("Ã ", "à")
$content = $content.Replace("Â°", "°")

# Wait, what if there's others? Let's check visually from what we know we wrote.
# DÃ‰CHARGE DE RESPONSABILITÃ‰ -> DÉCHARGE DE RESPONSABILITÉ
# DÃ©signation -> Désignation
# BÃ‰NÃ‰FICIAIRE -> BÉNÉFICIAIRE
# NÂ° de SÃ©rie -> N° de Série

$Utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $False
[System.IO.File]::WriteAllText("script.js", $content, $Utf8NoBomEncoding)

Write-Host "Success"
