<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog';

  let { open = $bindable(false), name, onConfirm }: { open?: boolean; name: string; onConfirm: () => void } = $props();
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete {name}?</AlertDialog.Title>
      <AlertDialog.Description>
        The banner and its undo history are removed from this browser. Download the project file first if you want to keep a copy.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" onclick={() => { open = false; onConfirm(); }}>Delete</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
