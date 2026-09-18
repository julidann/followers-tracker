import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';

import {
  ApiService,
  Dashboard,
  RelationshipList,
  SnapshotPayload,
} from './app/api.service';

type Feature = {
  label: string;
  kind?: string;
  soon?: boolean;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">PERSONAL INSTAGRAM ANALYTICS</p>
          <h1>Followers Tracker</h1>
        </div>
        <button class="profile-button" type="button" (click)="toggleImport()">
          {{ dashboard?.account_username ? '@' + dashboard?.account_username : 'Conectar Instagram' }}
        </button>
      </header>

      <section class="hero">
        <div>
          <p class="muted">Resumen</p>
          <h2>Tu comunidad, más clara.</h2>
          <p class="muted">
            @if (dashboard?.has_data) {
              Último análisis de @{{ dashboard?.account_username }}
            } @else {
              Todavía no hay un snapshot cargado.
            }
          </p>
        </div>
        <button class="primary-button" type="button" (click)="toggleImport()">
          {{ dashboard?.has_data ? 'Cargar nuevo snapshot' : 'Crear primer análisis' }}
        </button>
      </section>

      @if (message) {
        <section class="notice" [class.error]="hasError">{{ message }}</section>
      }

      @if (showImport) {
        <section class="panel import-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">SNAPSHOT</p>
              <h3>Cargar datos para comparar</h3>
              <p class="muted small">
                Por ahora pegamos followers y following manualmente. El motor de comparación ya queda listo para conectar Instagram después.
              </p>
            </div>
          </div>

          <div class="form-grid">
            <label class="field full">
              <span>Usuario de Instagram</span>
              <input
                [(ngModel)]="accountUsername"
                placeholder="tu_usuario"
                autocomplete="off"
              >
            </label>

            <label class="field">
              <span>Followers</span>
              <textarea
                [(ngModel)]="followersText"
                rows="9"
                placeholder="usuario1&#10;usuario2&#10;usuario3"
              ></textarea>
              <small>Uno por línea, coma o espacio.</small>
            </label>

            <label class="field">
              <span>Following</span>
              <textarea
                [(ngModel)]="followingText"
                rows="9"
                placeholder="usuario1&#10;usuario4&#10;usuario5"
              ></textarea>
              <small>Uno por línea, coma o espacio.</small>
            </label>
          </div>

          <div class="form-actions">
            <button class="secondary-button" type="button" (click)="showImport = false">
              Cancelar
            </button>
            <button
              class="primary-button"
              type="button"
              [disabled]="saving"
              (click)="saveSnapshot()"
            >
              {{ saving ? 'Guardando...' : 'Guardar snapshot' }}
            </button>
          </div>
        </section>
      }

      <section class="stats-grid">
        @for (item of stats; track item.label) {
          <article class="stat-card">
            <span>{{ item.icon }}</span>
            <p>{{ item.label }}</p>
            <strong>{{ item.value }}</strong>
          </article>
        }
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">RELACIONES</p>
            <h3>Análisis de seguidores</h3>
          </div>
          @if (dashboard?.captured_at) {
            <span class="snapshot-date">
              {{ formatDate(dashboard?.captured_at ?? null) }}
            </span>
          }
        </div>

        <div class="feature-grid">
          @for (feature of features; track feature.label) {
            <button
              class="feature-card"
              [class.disabled]="feature.soon"
              type="button"
              (click)="openFeature(feature)"
            >
              <span>{{ feature.label }}</span>
              @if (feature.soon) {
                <small>Próximamente</small>
              }
            </button>
          }
        </div>
      </section>

      @if (relationshipResult) {
        <section class="panel result-panel">
          <div class="result-header">
            <div>
              <p class="eyebrow">RESULTADO</p>
              <h3>{{ selectedFeatureLabel }}</h3>
            </div>
            <span class="result-count">{{ relationshipResult.count }}</span>
          </div>

          @if (relationshipResult.usernames.length) {
            <div class="user-list">
              @for (username of relationshipResult.usernames; track username) {
                <div class="user-row">
                  <div class="avatar">{{ username.charAt(0).toUpperCase() }}</div>
                  <span>@{{ username }}</span>
                </div>
              }
            </div>
          } @else {
            <p class="muted empty-state">No hay cuentas en esta categoría.</p>
          }
        </section>
      }
    </main>
  `,
})
class AppComponent implements OnInit {
  private readonly api = inject(ApiService);

  dashboard: Dashboard | null = null;
  relationshipResult: RelationshipList | null = null;
  selectedFeatureLabel = '';

  showImport = false;
  saving = false;
  message = '';
  hasError = false;

  accountUsername = '';
  followersText = '';
  followingText = '';

  readonly features: Feature[] = [
    { label: 'No me siguen', kind: 'not-following-back' },
    { label: 'Yo no sigo', kind: 'i-dont-follow-back' },
    { label: 'Mutuos', kind: 'mutuals' },
    { label: 'Nuevos seguidores', kind: 'new-followers' },
    { label: 'Unfollowers', kind: 'unfollowers' },
    { label: 'Followers', kind: 'followers' },
    { label: 'Following', kind: 'following' },
    { label: 'Admiradores', soon: true },
    { label: 'Ghost followers', soon: true },
    { label: 'Active followers', soon: true },
    { label: 'Lost interest', soon: true },
    { label: 'Post analytics', soon: true },
    { label: 'Stories analytics', soon: true },
  ];

  ngOnInit(): void {
    this.loadDashboard();
  }

  get stats() {
    return [
      { label: 'Followers', icon: '👥', value: this.dashboard?.followers ?? 0 },
      { label: 'Following', icon: '↗️', value: this.dashboard?.following ?? 0 },
      { label: 'Nuevos', icon: '✨', value: this.dashboard?.new_followers ?? 0 },
      { label: 'Unfollowers', icon: '📉', value: this.dashboard?.unfollowers ?? 0 },
    ];
  }

  toggleImport(): void {
    this.showImport = !this.showImport;
    this.message = '';
    this.hasError = false;

    if (!this.accountUsername && this.dashboard?.account_username) {
      this.accountUsername = this.dashboard.account_username;
    }
  }

  saveSnapshot(): void {
    const username = this.accountUsername.trim().replace(/^@/, '');
    if (!username) {
      this.showMessage('Ingresá tu usuario de Instagram.', true);
      return;
    }

    const payload: SnapshotPayload = {
      account_username: username,
      followers: this.parseUsers(this.followersText),
      following: this.parseUsers(this.followingText),
    };

    this.saving = true;
    this.api.createSnapshot(payload).subscribe({
      next: () => {
        this.saving = false;
        this.showImport = false;
        this.relationshipResult = null;
        this.showMessage('Snapshot guardado. El dashboard ya usa datos reales de PostgreSQL.');
        this.loadDashboard(username);
      },
      error: () => {
        this.saving = false;
        this.showMessage('No se pudo guardar el snapshot. Revisá que backend y PostgreSQL estén corriendo.', true);
      },
    });
  }

  openFeature(feature: Feature): void {
    if (feature.soon || !feature.kind) return;

    if (!this.dashboard?.has_data) {
      this.showMessage('Primero cargá un snapshot.', true);
      return;
    }

    this.selectedFeatureLabel = feature.label;
    this.api
      .getRelationships(feature.kind, this.dashboard.account_username ?? undefined)
      .subscribe({
        next: (result) => {
          this.relationshipResult = result;
          this.message = '';
        },
        error: () => this.showMessage('No se pudo cargar esa lista.', true),
      });
  }

  formatDate(value: string | null): string {
    if (!value) return '';
    return new Date(value).toLocaleString('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  private loadDashboard(account?: string): void {
    this.api.getDashboard(account).subscribe({
      next: (data) => {
        this.dashboard = data;
        if (data.account_username) this.accountUsername = data.account_username;
      },
      error: () => this.showMessage('No se pudo conectar con la API.', true),
    });
  }

  private parseUsers(value: string): string[] {
    return [
      ...new Set(
        value
          .split(/[\s,;]+/)
          .map((item) => item.trim().replace(/^@/, '').toLowerCase())
          .filter(Boolean),
      ),
    ];
  }

  private showMessage(message: string, error = false): void {
    this.message = message;
    this.hasError = error;
  }
}

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient()],
}).catch(console.error);
