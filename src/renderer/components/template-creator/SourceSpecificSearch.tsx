import React, { useState, useEffect } from 'react';
import { Input } from '@/renderer/components/ui/input';
import { Button } from '@/renderer/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card';
import { Badge } from '@/renderer/components/ui/badge';
import { ResourceDetailModal } from './ResourceDetailModal'; // Add this 
import { FlattenedResource, SchemaSource } from '../../../shared/types/schema';

/**
 * Component for testing source-specific schema search
 */
export function SourceSpecificSearch() {
  const [sources, setSources] = useState<SchemaSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FlattenedResource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sourceStats, setSourceStats] = useState<Record<string, { resourceCount: number; enabled: boolean }>>({});

  const [selectedResource, setSelectedResource] = useState<FlattenedResource | null>(null); // Add this
  const [showDetailModal, setShowDetailModal] = useState(false); // Add this

  useEffect(() => {
    const initializeSchema = async () => {
      try {
        // Initialize the schema service first
        await window.electronAPI.invoke('schema:initialize');
        // Then load sources
        await loadSources();
      } catch (error) {
        console.error('Failed to initialize schema service:', error);
      }
    };

    initializeSchema();
  }, []);

  /**
   * Load available schema sources on component mount
   */
  useEffect(() => {
    loadSources();
  }, []);

  /**
   * Load source statistics when sources change
   */
  useEffect(() => {
    if (sources.length > 0) {
      loadSourceStats();
    }
  }, [sources]);

  /**
   * Load available schema sources
   */
  const loadSources = async () => {
    try {
      const availableSources = await window.electronAPI.invoke('schema:getAvailableSources');
      setSources(availableSources);

      // Auto-select first enabled source
      const firstEnabled = availableSources.find((s: SchemaSource) => s.enabled);
      if (firstEnabled) {
        setSelectedSource(firstEnabled.id);
      }
    } catch (error) {
      console.error('Failed to load schema sources:', error);
    }
  };

  /**
   * Load statistics for all sources
   */
  const loadSourceStats = async () => {
    const stats: Record<string, { resourceCount: number; enabled: boolean }> = {};

    for (const source of sources) {
      try {
        const sourceStat = await window.electronAPI.invoke('schema:getSourceStats', source.id);
        if (sourceStat) {
          stats[source.id] = sourceStat;
        }
      } catch (error) {
        console.error(`Failed to load stats for source ${source.id}:`, error);
      }
    }

    setSourceStats(stats);
  };

  /**
   * Perform search within the selected source
   */
  const performSearch = async () => {
    if (!selectedSource || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await window.electronAPI.invoke('schema:searchInSource', selectedSource, searchQuery.trim());
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load all resources from the selected source
   */
  const loadAllFromSource = async () => {
    if (!selectedSource) return;

    setIsLoading(true);
    try {
      const results = await window.electronAPI.invoke('schema:getResourcesFromSource', selectedSource);
      setSearchResults(results);
      setSearchQuery(''); // Clear search query to indicate we're showing all
    } catch (error) {
      console.error('Failed to load all resources:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
 * Handle clicking on a resource to view details
 */
  const handleResourceClick = (resource: FlattenedResource) => {
    setSelectedResource(resource);
    setShowDetailModal(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Source-Specific Schema Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Source Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Schema Source</label>
            <Select value={selectedSource} onValueChange={setSelectedSource}>
              <SelectTrigger>
                <SelectValue placeholder="Select a schema source" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((source) => {
                  const stats = sourceStats[source.id];
                  return (
                    <SelectItem key={source.id} value={source.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{source.name}</span>
                        {stats && (
                          <Badge variant={stats.enabled ? "default" : "secondary"}>
                            {stats.resourceCount} resources
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Search Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Search Query</label>
            <div className="flex gap-2">
              <Input
                placeholder="Search for resource kinds..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && performSearch()}
              />
              <Button onClick={performSearch} disabled={isLoading || !selectedSource}>
                {isLoading ? 'Searching...' : 'Search'}
              </Button>
              <Button
                variant="outline"
                onClick={loadAllFromSource}
                disabled={isLoading || !selectedSource}
              >
                Show All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Search Results ({searchResults.length})
              {selectedSource && sourceStats[selectedSource] && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  from {sourceStats[selectedSource].resourceCount} total resources
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {searchResults.map((resource, index) => (
                <div
                  key={index}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" // Add cursor-pointer
                  onClick={() => handleResourceClick(resource)} // Add click handler
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{resource.kind}</h4>
                      {resource.apiVersion && (
                        <p className="text-sm text-gray-600">{resource.apiVersion}</p>
                      )}
                      {resource.description && (
                        <p className="text-sm text-gray-500 mt-1">{resource.description}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{resource.source}</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent triggering the card click
                          handleResourceClick(resource);
                        }}
                      >
                        View Schema
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {/* {searchQuery && searchResults.length === 0 && !isLoading && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500">No resources found for "{searchQuery}" in the selected source.</p>
          </CardContent>
        </Card>
      )} */}

      <ResourceDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        resource={selectedResource}
      />

    </div>
  );
}