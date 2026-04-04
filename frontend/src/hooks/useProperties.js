import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProperties,
  fetchProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  fetchPropertyStats,
  importPropertiesCsv,
  extractFromFlyer,
  syncPropertyVectors,
} from '../api/properties';

export function useProperties(filters) {
  return useQuery({
    queryKey: ['properties', filters],
    queryFn: () => fetchProperties(filters),
  });
}

export function useProperty(id) {
  return useQuery({
    queryKey: ['properties', id],
    queryFn: () => fetchProperty(id),
    enabled: !!id,
    staleTime: 0,
  });
}

export function usePropertyStats() {
  return useQuery({
    queryKey: ['propertyStats'],
    queryFn: fetchPropertyStats,
    staleTime: 30_000, // 30s cache
  });
}

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProperty,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties'] });
      qc.invalidateQueries({ queryKey: ['propertyStats'] });
    },
  });
}

export function useUpdateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateProperty(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties'] });
      qc.invalidateQueries({ queryKey: ['propertyStats'] });
    },
  });
}

export function useDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteProperty,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties'] });
      qc.invalidateQueries({ queryKey: ['propertyStats'] });
    },
  });
}

export function useImportProperties() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importPropertiesCsv,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties'] });
      qc.invalidateQueries({ queryKey: ['propertyStats'] });
    },
  });
}

export function useExtractFlyer() {
  return useMutation({
    mutationFn: extractFromFlyer,
  });
}

export function useSyncVectors() {
  return useMutation({
    mutationFn: syncPropertyVectors,
  });
}
