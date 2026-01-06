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
        className="gap-6"
      >
        {/* Internal top menu (Configuration-style selected state, but doesn't steal width) */}
        <TabsList
          className={[
            'h-auto w-full items-center justify-start',
            'bg-slate-900 border border-slate-800 p-2 rounded-lg flex flex-row gap-1',
            'overflow-x-auto',
            'relative z-20',
          ].join(' ')}
        >
          <TabsTrigger
            value="pc-history"
            className="flex-none h-auto justify-start py-2 px-3 data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <PcCase className="w-4 h-4 mr-2" />
            PC History
          </TabsTrigger>

          <TabsTrigger
            value="job-monitor"
            className="flex-none h-auto justify-start py-2 px-3 data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <ListChecks className="w-4 h-4 mr-2" />
            Job Monitor
          </TabsTrigger>

          <TabsTrigger
            value="results"
            className="flex-none h-auto justify-start py-2 px-3 data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <Database className="w-4 h-4 mr-2" />
            Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pc-history" className="min-w-0">
          <PcViewer embedded />
        </TabsContent>

        <TabsContent value="job-monitor" className="min-w-0">
          <JobMonitor embedded />
        </TabsContent>

        <TabsContent value="results" className="min-w-0">
          <ResultsViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
}


