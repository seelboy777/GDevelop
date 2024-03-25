// @flow
import { Trans } from '@lingui/macro';
import * as React from 'react';
import { type ParameterInlineRendererProps } from './ParameterInlineRenderer.flow';
import VariableField, {
  renderVariableWithIcon,
  type VariableFieldInterface,
} from './VariableField';
import VariablesEditorDialog from '../../VariablesList/VariablesEditorDialog';
import {
  type ParameterFieldProps,
  type ParameterFieldInterface,
  type FieldFocusFunction,
} from './ParameterFieldCommons';
import { getLastObjectParameterValue } from './ParameterMetadataTools';
import EventsRootVariablesFinder from '../../Utils/EventsRootVariablesFinder';
import getObjectByName from '../../Utils/GetObjectByName';
import getObjectGroupByName from '../../Utils/GetObjectGroupByName';
import ObjectIcon from '../../UI/CustomSvgIcons/Object';
import { enumerateValidVariableNames } from './EnumerateVariables';
import intersection from 'lodash/intersection';

const gd: libGDevelop = global.gd;

// TODO Move this function to the ObjectsContainersList class.
const getObjectOrGroupVariablesContainers = (
  globalObjectsContainer: gdObjectsContainer,
  objectsContainer: gdObjectsContainer,
  objectName: string
): Array<gdVariablesContainer> => {
  const object = getObjectByName(
    globalObjectsContainer,
    objectsContainer,
    objectName
  );
  const variablesContainers: Array<gdVariablesContainer> = [];
  if (object) {
    variablesContainers.push(object.getVariables());
  } else {
    const group = getObjectGroupByName(
      globalObjectsContainer,
      objectsContainer,
      objectName
    );
    if (group) {
      for (const subObjectName of group.getAllObjectsNames().toJSArray()) {
        const subObject = getObjectByName(
          globalObjectsContainer,
          objectsContainer,
          subObjectName
        );
        if (subObject) {
          variablesContainers.push(subObject.getVariables());
        }
      }
    }
  }
  return variablesContainers;
};

export const isUnifiedObjectInstruction = (type: string): boolean =>
  type === 'VarObjetTxt' ||
  type === 'ObjectVariableAsBoolean' ||
  type === 'ModVarObjetTxt' ||
  type === 'SetObjectVariableAsBoolean';

export const getUnifiedObjectInstructionType = (
  instructionType: string
): string =>
  instructionType === 'VarObjetTxt' ||
  instructionType === 'ObjectVariableAsBoolean'
    ? 'VarObjet'
    : instructionType === 'ModVarObjetTxt' ||
      instructionType === 'SetObjectVariableAsBoolean'
    ? 'ModVarObjet'
    : instructionType;

export const switchBetweenUnifiedObjectInstructionIfNeeded = (
  projectScopedContainers: gdProjectScopedContainers,
  instruction: gdInstruction
): void => {
  const objectsContainersList = projectScopedContainers.getObjectsContainersList();

  if (
    (instruction.getType() === 'VarObjet' ||
      instruction.getType() === 'VarObjetTxt' ||
      instruction.getType() === 'ObjectVariableAsBoolean') &&
    instruction.getParametersCount() > 0
  ) {
    const objectName = instruction.getParameter(0).getPlainString();
    const variableName = instruction.getParameter(1).getPlainString();
    if (
      objectsContainersList.hasObjectOrGroupWithVariableNamed(
        objectName,
        variableName
      )
    ) {
      const variable = objectsContainersList
        .getObjectOrGroupVariablesContainer(objectName)
        .get(variableName);
      if (variable.getType() === gd.Variable.String) {
        instruction.setType('VarObjetTxt');
        instruction.setParametersCount(4);
      } else if (variable.getType() === gd.Variable.Number) {
        instruction.setType('VarObjet');
        instruction.setParametersCount(4);
      } else if (variable.getType() === gd.Variable.Boolean) {
        instruction.setType('ObjectVariableAsBoolean');
        instruction.setParametersCount(3);
      }
    }
  } else if (
    (instruction.getType() === 'ModVarObjet' ||
      instruction.getType() === 'ModVarObjetTxt' ||
      instruction.getType() === 'SetObjectVariableAsBoolean') &&
    instruction.getParametersCount() > 0
  ) {
    const objectName = instruction.getParameter(0).getPlainString();
    const variableName = instruction.getParameter(1).getPlainString();
    if (
      objectsContainersList.hasObjectOrGroupWithVariableNamed(
        objectName,
        variableName
      )
    ) {
      const variable = objectsContainersList
        .getObjectOrGroupVariablesContainer(objectName)
        .get(variableName);
      if (variable.getType() === gd.Variable.String) {
        instruction.setType('ModVarObjetTxt');
        instruction.setParametersCount(4);
      } else if (variable.getType() === gd.Variable.Number) {
        instruction.setType('ModVarObjet');
        instruction.setParametersCount(4);
      } else if (variable.getType() === gd.Variable.Boolean) {
        instruction.setType('SetObjectVariableAsBoolean');
        instruction.setParametersCount(3);
      }
    }
  }
};

export default React.forwardRef<ParameterFieldProps, ParameterFieldInterface>(
  function ObjectVariableField(props: ParameterFieldProps, ref) {
    const field = React.useRef<?VariableFieldInterface>(null);
    const [editorOpen, setEditorOpen] = React.useState(false);
    const focus: FieldFocusFunction = options => {
      if (field.current) field.current.focus(options);
    };
    React.useImperativeHandle(ref, () => ({
      focus,
    }));

    const {
      project,
      globalObjectsContainer,
      objectsContainer,
      scope,
      instructionMetadata,
      instruction,
      expressionMetadata,
      expression,
      parameterIndex,
    } = props;

    const objectName = getLastObjectParameterValue({
      instructionMetadata,
      instruction,
      expressionMetadata,
      expression,
      parameterIndex,
    });

    const { layout } = scope;
    const object = objectName
      ? getObjectByName(globalObjectsContainer, objectsContainer, objectName)
      : null;
    const variablesContainers = React.useMemo<Array<gdVariablesContainer>>(
      () =>
        objectName
          ? getObjectOrGroupVariablesContainers(
              globalObjectsContainer,
              objectsContainer,
              objectName
            )
          : [],
      [objectName, globalObjectsContainer, objectsContainer]
    );

    const enumerateVariableNames = React.useCallback(
      () =>
        variablesContainers
          .map(variablesContainer =>
            enumerateValidVariableNames(variablesContainer)
          )
          .reduce((a, b) => intersection(a, b)),
      [variablesContainers]
    );

    const onComputeAllVariableNames = () =>
      project && layout && object
        ? EventsRootVariablesFinder.findAllObjectVariables(
            project.getCurrentPlatform(),
            project,
            layout,
            object
          )
        : [];

    return (
      <React.Fragment>
        <VariableField
          variablesContainers={variablesContainers}
          enumerateVariableNames={enumerateVariableNames}
          parameterMetadata={props.parameterMetadata}
          value={props.value}
          onChange={props.onChange}
          isInline={props.isInline}
          onRequestClose={props.onRequestClose}
          onApply={props.onApply}
          ref={field}
          onOpenDialog={() => setEditorOpen(true)}
          globalObjectsContainer={props.globalObjectsContainer}
          objectsContainer={props.objectsContainer}
          scope={scope}
          id={
            props.parameterIndex !== undefined
              ? `parameter-${props.parameterIndex}-object-variable-field`
              : undefined
          }
        />
        {editorOpen &&
          // There is no variable editor for groups.
          variablesContainers.length === 1 &&
          project && (
            <VariablesEditorDialog
              project={project}
              title={<Trans>Object Variables</Trans>}
              open={editorOpen}
              variablesContainer={variablesContainers[0]}
              emptyPlaceholderTitle={
                <Trans>Add your first object variable</Trans>
              }
              emptyPlaceholderDescription={
                <Trans>
                  These variables hold additional information on an object.
                </Trans>
              }
              helpPagePath={'/all-features/variables/object-variables'}
              onComputeAllVariableNames={onComputeAllVariableNames}
              onCancel={() => setEditorOpen(false)}
              onApply={() => {
                setEditorOpen(false);
                if (field.current) field.current.updateAutocompletions();
              }}
              preventRefactoringToDeleteInstructions
            />
          )}
      </React.Fragment>
    );
  }
);

export const renderInlineObjectVariable = (
  props: ParameterInlineRendererProps
) => renderVariableWithIcon(props, ObjectIcon, 'object variable');
