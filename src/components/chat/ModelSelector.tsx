import { useState } from 'react';
import { RiArrowDownSLine, RiLock2Line } from '@remixicon/react';
import { useAIStore } from '../../store/useAIStore';
import { useAuthStore } from '../../store/useAuthStore';
import { isModelAvailable } from '../../utils/featureGates';
import { UpgradeModal } from '../UpgradeModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export function ModelSelector() {
  const {
    selectedProvider,
    selectedModel,
    availableModels,
    setProvider,
    setModel,
  } = useAIStore();
  const { subscription } = useAuthStore();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const tier = subscription?.tier ?? 'free';

  // Get display name for current model
  const getCurrentModelName = () => {
    if (!availableModels) return selectedModel;

    const providerModels = availableModels[selectedProvider];
    const model = providerModels?.find((m) => m.id === selectedModel);
    return model?.name || selectedModel;
  };

  // Handle model selection - also sets provider if needed
  const handleModelSelect = (modelId: string) => {
    if (!availableModels) return;

    // Check if model is available for user's tier
    if (!isModelAvailable(modelId, tier)) {
      setShowUpgradeModal(true);
      return;
    }

    // Find which provider this model belongs to
    for (const provider of ['openai', 'anthropic', 'gemini'] as const) {
      const models = availableModels[provider];
      if (models?.some((m) => m.id === modelId)) {
        if (provider !== selectedProvider) {
          setProvider(provider);
        }
        setModel(modelId);
        return;
      }
    }
  };

  // Check if a model is premium (locked for free users)
  const isPremiumModel = (modelId: string) => !isModelAvailable(modelId, tier);

  // Build combined value for radio group (provider:model)
  const currentValue = `${selectedProvider}:${selectedModel}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground
                     hover:bg-muted rounded transition-colors"
        >
          <span className="max-w-[120px] truncate">{getCurrentModelName()}</span>
          <RiArrowDownSLine size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuRadioGroup
          value={currentValue}
          onValueChange={(value) => {
            const [, modelId] = value.split(':');
            handleModelSelect(modelId);
          }}
        >
          {/* Anthropic Models */}
          {availableModels?.anthropic && availableModels.anthropic.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Anthropic
              </DropdownMenuLabel>
              {availableModels.anthropic.map((model) => (
                <DropdownMenuRadioItem
                  key={model.id}
                  value={`anthropic:${model.id}`}
                  className="text-sm flex items-center justify-between"
                >
                  <span>{model.name}</span>
                  {isPremiumModel(model.id) && (
                    <RiLock2Line size={12} className="text-muted-foreground ml-2" />
                  )}
                </DropdownMenuRadioItem>
              ))}
            </>
          )}

          {/* Separator between providers */}
          {availableModels?.anthropic &&
            availableModels.anthropic.length > 0 &&
            availableModels?.openai &&
            availableModels.openai.length > 0 && <DropdownMenuSeparator />}

          {/* OpenAI Models */}
          {availableModels?.openai && availableModels.openai.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                OpenAI
              </DropdownMenuLabel>
              {availableModels.openai.map((model) => (
                <DropdownMenuRadioItem
                  key={model.id}
                  value={`openai:${model.id}`}
                  className="text-sm flex items-center justify-between"
                >
                  <span>{model.name}</span>
                  {isPremiumModel(model.id) && (
                    <RiLock2Line size={12} className="text-muted-foreground ml-2" />
                  )}
                </DropdownMenuRadioItem>
              ))}
            </>
          )}

          {/* Separator before Gemini */}
          {((availableModels?.anthropic && availableModels.anthropic.length > 0) ||
            (availableModels?.openai && availableModels.openai.length > 0)) &&
            availableModels?.gemini &&
            availableModels.gemini.length > 0 && <DropdownMenuSeparator />}

          {/* Gemini Models */}
          {availableModels?.gemini && availableModels.gemini.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Google
              </DropdownMenuLabel>
              {availableModels.gemini.map((model) => (
                <DropdownMenuRadioItem
                  key={model.id}
                  value={`gemini:${model.id}`}
                  className="text-sm flex items-center justify-between"
                >
                  <span>{model.name}</span>
                  {isPremiumModel(model.id) && (
                    <RiLock2Line size={12} className="text-muted-foreground ml-2" />
                  )}
                </DropdownMenuRadioItem>
              ))}
            </>
          )}
        </DropdownMenuRadioGroup>

        {/* Show message if no models available */}
        {(!availableModels ||
          (availableModels.anthropic?.length === 0 &&
            availableModels.openai?.length === 0 &&
            availableModels.gemini?.length === 0)) && (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">
            No models available
          </div>
        )}
      </DropdownMenuContent>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </DropdownMenu>
  );
}
