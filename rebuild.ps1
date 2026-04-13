$content = Get-Content 'index.html' -Encoding UTF8
$top = $content[0..20]
$bottom = $content[93..($content.Length-1)]

$splash = @(
  "  <!-- ===================== PREMIUM SPLASH v4.0 ===================== -->",
  "  <div id=`"splashScreen`" class=`"splash-screen`">",
  "    <div class=`"splash-glass-panel`">",
  "      <!-- Centered Logo with soft glow -->",
  "      <div class=`"splash-logo-container`">",
  "        <div class=`"logo-outer-glow`"></div>",
  "        <div class=`"logo-inner-glass`">",
  "          <img src=`"assets/LOGOLABO.jpg`" alt=`"Logo`" class=`"main-logo-img`">",
  "        </div>",
  "      </div>",
  "      <div class=`"splash-main-text`">",
  "        <div class=`"brand-kicker`">ENTERPRISE IT MANAGEMENT</div>",
  "        <h1 class=`"brand-title`">LABO-IT <span class=`"accent-text`">CONTROL</span></h1>",
  "        <div class=`"brand-tagline`">Système de gestion et de suivi du parc informatique</div>",
  "      </div>",
  "      <div class=`"splash-progress-container`">",
  "        <div class=`"progress-bar-minimal`">",
  "          <div class=`"progress-bar-fill`"></div>",
  "        </div>",
  "        <div class=`"progress-status-row`">",
  "          <span class=`"splash-status-text`">Initialisation...</span>",
  "          <span class=`"splash-progress-pct`">0%</span>",
  "        </div>",
  "      </div>",
  "      <div class=`"splash-v4-footer`">",
  "        <div class=`"version-pill`">v1.2.0 Official</div>",
  "        <div class=`"dev-credits`">Distributed by <span class=`"highlight`">Billel Bouraba</span></div>",
  "      </div>",
  "    </div>",
  "  </div>"
)

$newContent = $top + $splash + $bottom
$newContent | Set-Content 'index.html' -Encoding UTF8
