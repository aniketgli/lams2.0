import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { sendSlackNotification } from '../services/slackService';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Badge,
  FormField,
  Input,
  Switch
} from '../components';
import {
  MessageSquare,
  Send,
  CheckCircle,
  AlertCircle,
  Check,
  Radio
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
      setTestResult('Successfully delivered to Slack Webhook!');
    } else {
      setTestResult('Dispatched to interactive Slack feed stream.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
    >
      <ModalHeader
        title="Slack Notifications Engine"
        subtitle="Real-time webhook events & interactive channel notification stream"
        icon={MessageSquare}
        onClose={onClose}
      />

      {/* Tabs */}
      <div className="flex items-center space-x-2 px-6 pt-3 bg-slate-50 border-b border-slate-200 text-xs">
        <Button
          variant={activeTab === 'feed' ? 'primary' : 'outline'}
          size="xs"
          onClick={() => setActiveTab('feed')}
        >
          Live Slack Stream ({slackLogs.length})
        </Button>
        <Button
          variant={activeTab === 'settings' ? 'primary' : 'outline'}
          size="xs"
          onClick={() => setActiveTab('settings')}
        >
          Webhook Configuration
        </Button>
      </div>

      <ModalBody className="space-y-4 max-h-[60vh] overflow-y-auto">
        {activeTab === 'feed' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
              <span>Channel: <strong className="text-slate-800 font-mono">{slackConfig.defaultChannel}</strong></span>
              <Button
                variant="outline"
                size="xs"
                leftIcon={<Send className="w-3 h-3" />}
                onClick={handleTestSlack}
              >
                Fire Test Ping
              </Button>
            </div>

            {testResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{testResult}</span>
              </div>
            )}

            {slackLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                No notifications logged yet.
              </div>
            ) : (
              slackLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
                      <span className="font-bold text-slate-900 truncate">{log.title}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">{log.timestamp}</span>
                  </div>

                  <p className="text-slate-600 whitespace-pre-line leading-relaxed text-xs">{log.message}</p>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Sender: <strong className="text-slate-800">{log.sender}</strong></span>
                    <Badge variant="info" size="sm">
                      {log.deliveredStatus}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <form id="slack-settings-form" onSubmit={handleSaveConfig} className="space-y-4">
            {testResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{testResult}</span>
              </div>
            )}

            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="font-bold text-slate-900 block text-xs">Enable Slack Dispatch</span>
                <span className="text-[11px] text-slate-500">Broadcast workflow and attendance updates to Slack</span>
              </div>
              <Switch
                checked={enableSlack}
                onChange={setEnableSlack}
                size="sm"
              />
            </div>

            <FormField
              label="Incoming Webhook URL"
              helperText="Optional. If empty or invalid, notifications stream to the live built-in feed above."
            >
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T.../B.../..."
              />
            </FormField>

            <FormField label="Target Slack Channel">
              <Input
                value={defaultChannel}
                onChange={(e) => setDefaultChannel(e.target.value)}
                placeholder="#leave-and-attendance-logs"
              />
            </FormField>
          </form>
        )}
      </ModalBody>

      <ModalFooter>
        <Button
          variant="outline"
          onClick={onClose}
        >
          Close
        </Button>
        {activeTab === 'settings' ? (
          <Button
            type="submit"
            form="slack-settings-form"
            variant="primary"
          >
            Save Changes
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleTestSlack}
            leftIcon={<Send className="w-3.5 h-3.5" />}
          >
            Test Ping
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
};
