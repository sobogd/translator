"use client";

export async function apiFetch(input: string, init: RequestInit = {}) {
  return fetch(input, init);
}
