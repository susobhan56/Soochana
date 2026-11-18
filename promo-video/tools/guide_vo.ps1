# Speaks every line of src/data/narration.json with Windows' built-in voice and
# saves public/audio/vo-guide/NN.wav: a guide track to check timing before the
# real voice is recorded.  Run: powershell -File tools/guide_vo.ps1
Add-Type -AssemblyName System.Speech

$root = Split-Path -Parent $PSScriptRoot
$data = Get-Content (Join-Path $root 'src/data/narration.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$out = Join-Path $root 'public/audio/vo-guide'
New-Item -ItemType Directory -Force $out | Out-Null

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voices = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo }
# Prefer an Indian English voice, then any female English voice.
$pick = $voices | Where-Object { $_.Culture.Name -eq 'en-IN' } | Select-Object -First 1
if (-not $pick) { $pick = $voices | Where-Object { $_.Gender -eq 'Female' -and $_.Culture.Name -like 'en-*' } | Select-Object -First 1 }
if ($pick) { $synth.SelectVoice($pick.Name) }
$synth.Rate = 2
Write-Output ("voice: " + $synth.Voice.Name)

foreach ($c in $data.cues) {
  $file = Join-Path $out $c.file
  $synth.SetOutputToWaveFile($file)
  # Spell Soochana the way it is said.
  $synth.Speak(($c.text -replace 'Soochana', 'Soo-chuh-naa' -replace 'Mitali', 'Mi-ta-lee'))
  $synth.SetOutputToNull()
  Write-Output ("wrote " + $c.file)
}
$synth.Dispose()
