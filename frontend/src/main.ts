import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <main class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">PERSONAL INSTAGRAM ANALYTICS</p>
          <h1>Followers Tracker</h1>
        </div>
        <button class="profile-button" type="button">Conectar Instagram</button>
      </header>

      <section class="hero">
        <div>
          <p class="muted">Resumen</p>
          <h2>Tu comunidad, más clara.</h2>
          <p class="muted">Todavía no hay un snapshot cargado.</p>
        </div>
        <button class="primary-button" type="button">Crear primer análisis</button>
      </section>

      <section class="stats-grid">
        @for (item of stats; track item.label) {
          <article class="stat-card">
            <span>{{ item.icon }}</span>
            <p>{{ item.label }}</p>
            <strong>0</strong>
          </article>
        }
      </section>

      <section class="panel">
        <div>
          <p class="eyebrow">RELACIONES</p>
          <h3>Análisis de seguidores</h3>
        </div>
        <div class="feature-grid">
          @for (feature of features; track feature) {
            <button class="feature-card" type="button">{{ feature }}</button>
          }
        </div>
      </section>
    </main>
  `,
})
class AppComponent {
  stats = [
    { label: 'Followers', icon: '👥' },
    { label: 'Following', icon: '↗️' },
    { label: 'Nuevos', icon: '✨' },
    { label: 'Unfollowers', icon: '📉' },
  ];

  features = [
    'No me siguen',
    'Yo no sigo',
    'Mutuos',
    'Admiradores',
    'Ghost followers',
    'Active followers',
    'Lost interest',
    'Post analytics',
    'Stories analytics',
  ];
}

bootstrapApplication(AppComponent).catch(console.error);
