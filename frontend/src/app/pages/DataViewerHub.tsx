import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Database, ListChecks, PcCase } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { PcViewer } from './PcViewer';
import { JobMonitor } from './JobMonitor';
import { DataViewer as ResultsViewer } from './DataViewer';

export function DataViewerHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'pc-history';
  const [activeTab, setActiveTab] = useState<string>(tabFromUrl);

  // Default to PC History if no tab is specified.
  useEffect(() => {
    if (!searchParams.get('tab')) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', 'pc-history');
        return next;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep local state in sync with URL param changes.
  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  return (
    <div className="p-8">
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', v);
            return next;
          });
        }}
        className="gap-6 lg:flex-row lg:items-start"
      >
        {/* Internal left menu (matches Configuration style) */}
        <TabsList
          className={[
            'h-auto w-full items-stretch justify-start',
            'bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col gap-1',
            'lg:w-72 lg:sticky lg:top-6 lg:max-h-[calc(100vh-8rem)] lg:overflow-auto',
          ].join(' ')}
        >
          <div role="presentation" className="px-2 pt-1 pb-1 text-[11px] uppercase tracking-wider text-slate-500">
            Data viewer
          </div>

          <TabsTrigger
            value="pc-history"
            className="w-full flex-none h-auto justify-start py-2 data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <PcCase className="w-4 h-4 mr-2" />
            PC History
          </TabsTrigger>

          <TabsTrigger
            value="job-monitor"
            className="w-full flex-none h-auto justify-start py-2 data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <ListChecks className="w-4 h-4 mr-2" />
            Job Monitor
          </TabsTrigger>

          <TabsTrigger
            value="results"
            className="w-full flex-none h-auto justify-start py-2 data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <Database className="w-4 h-4 mr-2" />
            Results
          </TabsTrigger>
        </TabsList>

        <div className="lg:flex-1 space-y-6">
          <TabsContent value="pc-history">
            <PcViewer embedded />
          </TabsContent>

          <TabsContent value="job-monitor">
            <JobMonitor embedded />
          </TabsContent>

          <TabsContent value="results">
            <ResultsViewer />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}


