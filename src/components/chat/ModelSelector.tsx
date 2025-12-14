import { ChevronDown } from 'lucide-react';
import { useAIStore } from '../../store/useAIStore';
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

    // Find which provider this model belongs to
    for (const provider of ['openai', 'anthropic'] as const) {
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
          <ChevronDown size={12} />
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
                  className="text-sm"
                >
                  {model.name}
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
                  className="text-sm"
                >
                  {model.name}
                </DropdownMenuRadioItem>
              ))}
            </>
          )}
        </DropdownMenuRadioGroup>

        {/* Show message if no models available */}
        {(!availableModels ||
          (availableModels.anthropic?.length === 0 &&
            availableModels.openai?.length === 0)) && (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">
            No models available
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
