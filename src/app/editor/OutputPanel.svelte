<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { useTracery } from '../context';
  import Section from '../controls/Section.svelte';
  import Segmented from '../controls/Segmented.svelte';
  import SettingSelect from '../controls/SettingSelect.svelte';

  const app = useTracery();
  const HINTS = {
    half: 'One cell holds two stacked pixels. Square pixels, safest everywhere.',
    quad: 'One cell holds a 2×2 grid. Finer dither, narrower output.',
    full: 'Two full blocks per pixel. Chunky and very wide.',
  };
</script>

<Section title="Blocks">
  <Segmented key="mode" label="Blocks" />
  <p class="text-muted-foreground m-0 text-[11px]">{HINTS[app.settings.mode]}</p>
</Section>

<Section title="Color depth">
  <Segmented key="color" label="Color depth" />
</Section>

<Section title="Width">
  <SettingSelect key="targetCols" label="Fit to" />
  <p class="text-muted-foreground m-0 text-[11px]">Resizes wide artwork so it fits the terminal. Zoom only changes the preview.</p>
</Section>

<Section>
  <div class="flex flex-col items-start gap-1.5">
    <Button variant="destructive" size="xs" onclick={() => app.reset()}>Reset everything</Button>
    <p class="text-muted-foreground m-0 text-[11px]">Restores the defaults. You can undo it.</p>
  </div>
</Section>
