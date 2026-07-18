import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
import Content from './dropdown-menu-content.svelte';
import Item from './dropdown-menu-item.svelte';
import Separator from './dropdown-menu-separator.svelte';
import Label from './dropdown-menu-label.svelte';

const Root = DropdownMenuPrimitive.Root;
const Trigger = DropdownMenuPrimitive.Trigger;
const Portal = DropdownMenuPrimitive.Portal;
const Group = DropdownMenuPrimitive.Group;
const GroupHeading = DropdownMenuPrimitive.GroupHeading;

export {
	Root,
	Trigger,
	Content,
	Item,
	Separator,
	Label,
	Portal,
	Group,
	GroupHeading,
	Root as DropdownMenu,
	Trigger as DropdownMenuTrigger,
	Content as DropdownMenuContent,
	Item as DropdownMenuItem,
	Separator as DropdownMenuSeparator,
	Label as DropdownMenuLabel,
	Portal as DropdownMenuPortal,
	Group as DropdownMenuGroup,
	GroupHeading as DropdownMenuGroupHeading
};
