import { Modal, type ModalProps } from './Modal'

export type BottomSheetProps = Omit<ModalProps, 'placement'>

export function BottomSheet(props: BottomSheetProps) {
  return <Modal {...props} placement="bottom" />
}
