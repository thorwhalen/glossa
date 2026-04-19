import { useQuery } from '@tanstack/react-query';
import {
  fetchGraphemePhoneme,
  fetchInventory,
  fetchLanguagesIndex,
  fetchLexicon,
  fetchLexiconsIndex,
  fetchPhonemeIndex,
} from '../lib/data';

export function useLanguagesIndex() {
  return useQuery({
    queryKey: ['languages'],
    queryFn: fetchLanguagesIndex,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useInventory(key: string | undefined) {
  return useQuery({
    queryKey: ['inventory', key],
    queryFn: () => fetchInventory(key!),
    enabled: Boolean(key),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function usePhonemeIndex() {
  return useQuery({
    queryKey: ['phoneme-index'],
    queryFn: fetchPhonemeIndex,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useLexicon(iso: string | undefined) {
  return useQuery({
    queryKey: ['lexicon', iso],
    queryFn: () => fetchLexicon(iso!),
    enabled: Boolean(iso),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}

export function useGraphemePhoneme(iso: string | undefined) {
  return useQuery({
    queryKey: ['grapheme-phoneme', iso],
    queryFn: () => fetchGraphemePhoneme(iso!),
    enabled: Boolean(iso),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}

export function useLexiconsIndex() {
  return useQuery({
    queryKey: ['lexicons-index'],
    queryFn: fetchLexiconsIndex,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
