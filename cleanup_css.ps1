$content = Get-Content 'style.css' -Encoding UTF8
# Lines to keep are 1 to 186 AND 521 to end
# Index is 0-based, so line 186 is content[185]
# Line 521 is content[520]
$keepTop = $content[0..185]
$keepBottom = $content[520..($content.Length-1)]
$newContent = $keepTop + $keepBottom
$newContent | Set-Content 'style.css' -Encoding UTF8
