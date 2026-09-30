import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { sendSlackNotification } from '../services/slackService';
import {
  MessageSquare,
  X,
  Send,
  CheckCircle,
  AlertCircle,
  Bell,
  Settings,
  Sparkles,
  RefreshCw,
  Clock,
  ExternalLink
} from 'lucide-react';

interface SlackHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SlackHubModal: React.FC<SlackHubModalProps> = ({ isOpen, onClose }) => {
  const { slackConfig, updateSlackConfig, slackLogs, currentUser } = useApp();

  const [activeTab, setActiveTab] = useState<'feed' | 'settings'>('feed');
  const [webhookUrl, setWebhookUrl] = useState(slackConfig.webhookUrl);
  const [defaultChannel, setDefaultChannel] = useState(slackConfig.defaultChannel);
  const [enableSlack, setEnableSlack] = useState(slackConfig.enableSlackNotifications);
  const [testResult, setTestResult] = useState<string>('');

  if (!isOpen) return null;

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateSlackConfig({
      ...slackConfig,
      webhookUrl,
      defaultChannel,
      enableSlackNotifications: enableSlack
    });
    setTestResult('Slack Webhook settings saved successfully!');
    setTimeout(() => setTestResult(''), 3000);
  };

  const handleTestSlack = async () => {
    setTestResult('Sending test payload to Slack...');
    const result = await sendSlackNotification(
      slackConfig,
      {
        channel: defaultChannel,
        sender: currentUser.name,
        title: '🧪 Slack Integration Test Notification',
        message: `This is a test notification sent from *Leave & Attendance Management Hub* by *${currentUser.name}*. Slack integration is fully operational!`,
        type: 'system'
      }
    );

    if (result.deliveredStatus === 'sent') {
      setTestResult('✅ Successfully delivered to Slack Webhook!');
    } else {
      setTestResult('ℹ️ Dispatched to interactive Slack feed stream.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full text-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">Slack Notifications Engine</h2>
              <p className="text-xs text-slate-400">Real-time webhook events & interactive channel feed</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center space-x-2 px-5 pt-3 bg-slate-800/40 border-b border-slate-700/60 text-xs">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-2 font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'feed'
                ? 'border-emerald-400 text-emerald-300 bg-slate-800'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Live Slack Stream ({slackLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'settings'
                ? 'border-emerald-400 text-emerald-300 bg-slate-800'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Webhook Settings
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'feed' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                <span>Channel: <strong className="text-emerald-400">{slackConfig.defaultChannel}</strong></span>
                <button
                  onClick={handleTestSlack}
                  className="text-emerald-400 hover:underline font-semibold flex items-center space-x-1"
                >
                  <Send className="w-3 h-3" />
                  <span>Fire Test Ping</span>
                </button>
              </div>

              {slackLogs.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">No notifications logged yet.</div>
              ) : (
                slackLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700/80 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span className="font-bold text-slate-200">{log.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                    </div>

                    <p className="text-slate-300 whitespace-pre-line leading-relaxed font-sans">{log.message}</p>

                    <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Sender: <strong className="text-slate-200">{log.sender}</strong></span>
                      <span className="uppercase font-mono text-emerald-400">{log.deliveredStatus}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              {testResult && (
                <div className="p-3 bg-emerald-950 border border-emerald-700/80 rounded-xl text-emerald-300 font-semibold flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{testResult}</span>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-slate-800 rounded-xl border border-slate-700">
                <div>
                  <span className="font-bold text-white block">Enable Slack Dispatch</span>
                  <span className="text-[11px] text-slate-400">Broadcast workflow changes to Slack</span>
                </div>
                <input
                  type="checkbox"
                  checked={enableSlack}
                  onChange={(e) => setEnableSlack(e.target.checked)}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Incoming Webhook URL</label>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/T.../B.../..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Optional. If empty or invalid, notifications stream to the live built-in Slack feed window.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Target Slack Channel</label>
                <input
                  type="text"
                  value={defaultChannel}
                  onChange={(e) => setDefaultChannel(e.target.value)}
                  placeholder="#leave-and-attendance-logs"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleTestSlack}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700"
                >
                  Test Webhook Payload
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                >
                  Save Slack Config
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
