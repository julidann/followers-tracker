import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Dashboard {
  has_data: boolean;
  account_username: string | null;
  captured_at: string | null;
  followers: number;
  following: number;
  new_followers: number;
  unfollowers: number;
  not_following_back: number;
  i_dont_follow_back: number;
  mutuals: number;
  ghost_followers: number;
  active_followers: number;
  lost_interest: number;
}

export interface RelationshipList {
  kind: string;
  count: number;
  usernames: string[];
}

export interface SnapshotPayload {
  account_username: string;
  followers: string[];
  following: string[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = 'http://localhost:8000/api';

  constructor(private readonly http: HttpClient) {}

  getDashboard(account?: string): Observable<Dashboard> {
    const params = account ? new HttpParams().set('account', account) : undefined;
    return this.http.get<Dashboard>(`${this.baseUrl}/dashboard`, { params });
  }

  createSnapshot(payload: SnapshotPayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/snapshots`, payload);
  }

  getRelationships(kind: string, account?: string): Observable<RelationshipList> {
    let params = new HttpParams();
    if (account) params = params.set('account', account);
    return this.http.get<RelationshipList>(
      `${this.baseUrl}/relationships/${kind}`,
      { params },
    );
  }
}
